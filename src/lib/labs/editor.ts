import { prisma } from "@/lib/db";
import { assetName, compileLab } from "./language/compile";
import type { Evidence } from "./language/evidence";
import { gradeLab, type GradeResult } from "./language/grade";
import { validateParamValues, type ParamValues } from "./language/params";
import type { CompileIssue, CompiledLab } from "./language/types";
import { runGate, type FolderIssue } from "./folder";
import { LabError, gradeStoredRun, loadSessionCtx, runEvidence, type LabAsset } from "./sessions";

/**
 * The in-browser check editor (docs/labs/spec.md 11): compile an edited
 * lab.yaml, grade it against real evidence (the version's references, a
 * stored session check run, or an uploaded evidence file), and publish it as
 * a new version once it passes the same reference gate as an upload.
 */

export type EditorSource =
  | { kind: "reference"; which: "good" | "broken" }
  | { kind: "run"; runId: string }
  | { kind: "upload"; evidence: unknown };

export type EditorRun = {
  errors: CompileIssue[];
  warnings: CompileIssue[];
  result: GradeResult | null;
  evidence: Evidence | null;
  params: ParamValues;
  problem: string | null;
};

type References = { good?: Evidence; broken?: Evidence; brokenExpect?: unknown } | null;

async function latestVersion(labId: string) {
  const v = await prisma.labVersion.findFirst({ where: { labId }, orderBy: { version: "desc" } });
  if (!v) throw new LabError("not_found", "This lab has no versions.", 404);
  return v;
}

const assetNames = (assets: unknown) => (assets as LabAsset[]).map((a) => assetName(a.file));

export async function editorSources(labId: string) {
  const v = await latestVersion(labId);
  const refs = v.references as References;
  const runs = await prisma.labCheckRun.findMany({
    where: { session: { labVersion: { labId } }, status: "GRADED" },
    orderBy: { requestedAt: "desc" },
    take: 40,
    select: {
      id: true, final: true, requestedAt: true, score: true, maxScore: true,
      session: { select: { user: { select: { name: true } }, labVersion: { select: { version: true } } } },
    },
  });
  return {
    version: v.version,
    source: v.source ?? "",
    references: { good: Boolean(refs?.good), broken: Boolean(refs?.broken) },
    runs: runs.map((r) => ({
      id: r.id,
      label: `${r.session.user.name} · ${r.final ? "final" : "practice"} · v${r.session.labVersion.version} · ${r.requestedAt.toISOString().slice(0, 16).replace("T", " ")}`,
      score: r.score,
      maxScore: r.maxScore,
    })),
  };
}

export async function runEditor(labId: string, yaml: string, source: EditorSource): Promise<EditorRun> {
  const v = await latestVersion(labId);
  const compiled = compileLab(yaml, { assets: assetNames(v.assets) });
  const out: EditorRun = { errors: [], warnings: compiled.warnings, result: null, evidence: null, params: {}, problem: null };
  if (!compiled.ok) return { ...out, errors: compiled.errors };
  const lab = compiled.lab;

  if (source.kind === "run") {
    const run = await prisma.labCheckRun.findUnique({ where: { id: source.runId } });
    if (!run) return { ...out, problem: "That check run no longer exists." };
    const ctx = await loadSessionCtx(run.sessionId);
    if (ctx.session.labVersion.labId !== labId) return { ...out, problem: "That check run belongs to another lab." };
    return { ...out, result: gradeStoredRun(ctx, run, lab), evidence: runEvidence(ctx, run), params: ctx.params };
  }

  let evidence: Evidence | undefined;
  if (source.kind === "reference") {
    const refs = v.references as References;
    evidence = source.which === "good" ? refs?.good : refs?.broken;
    if (!evidence) return { ...out, problem: `Version ${v.version} has no ${source.which} reference stored (it was uploaded before references were kept). Re-upload the folder, or upload the evidence file here.` };
  } else {
    evidence = source.evidence as Evidence;
    if (typeof evidence !== "object" || evidence === null || (evidence as Evidence).format !== 1 || typeof (evidence as Evidence).roles !== "object") {
      return { ...out, problem: "That file isn't evidence: expected { format: 1, roles: { … } }." };
    }
  }
  const params = evidence.params ?? {};
  const bad = validateParamValues(lab.params, params);
  if (bad) return { ...out, problem: `${bad} (the evidence's "params" don't fit this lab.yaml)` };
  const result = gradeLab(lab, evidence, { params, run: "final" });
  return { ...out, result, evidence, params };
}

export type PublishResult = { ok: true; version: number; draft: boolean } | { ok: false; errors: (CompileIssue | FolderIssue)[] };

/** Publish edited lab.yaml as the next version: same assets and references, gate re-run. */
export async function publishEdit(labId: string, yaml: string, byUserId: string): Promise<PublishResult> {
  const v = await latestVersion(labId);
  const compiled = compileLab(yaml, { assets: assetNames(v.assets) });
  if (!compiled.ok) return { ok: false, errors: compiled.errors };
  const lab: CompiledLab = compiled.lab;
  const refs = (v.references ?? {}) as NonNullable<References>;
  // With no good reference to check against, the edit is published as another draft.
  const gate = runGate(lab, refs, { reportMissingGood: false });
  if (gate.errors.length) return { ok: false, errors: gate.errors };

  const assets = (v.assets as LabAsset[]).filter((a) => lab.assets.includes(assetName(a.file)));
  const created = await prisma.labVersion.create({
    data: {
      labId,
      version: v.version + 1,
      zcl: lab.zcl,
      definition: lab as object,
      assets: assets as object[],
      gate: { ...gate.gate, warnings: compiled.warnings.map((w) => ({ file: "lab/lab.yaml", ...w })), checkedAt: new Date().toISOString(), editedFrom: v.version } as object,
      source: yaml,
      references: gate.references as object,
      draft: !gate.references.good,
      createdById: byUserId,
    },
  });
  await prisma.labAuditEvent.create({ data: { type: "LAB_EDITED", userId: byUserId, detail: { labId, fromVersion: v.version, toVersion: created.version } } });
  return { ok: true, version: created.version, draft: created.draft };
}
