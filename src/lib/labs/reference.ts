import { prisma } from "@/lib/db";
import type { Evidence } from "./language/evidence";
import { gradeLab } from "./language/grade";
import { runGate, type FolderIssue, type LabFolderReport } from "./folder";
import { LabError, loadSessionCtx, runEvidence } from "./sessions";

/**
 * Reference capture (docs/labs/building-labs.md): turn a real session's
 * evidence into a lab version's good or broken reference, so nobody has to
 * write evidence JSON by hand. A draft version (uploaded without a good
 * reference) becomes runnable by students once a captured good reference
 * scores full marks.
 */

export type ReferenceKind = "good" | "broken";

type References = { good?: Evidence; broken?: Evidence; brokenExpect?: unknown };

/**
 * The session's evidence in reference-file form: its best check run (the
 * final one, else the latest graded one), the baseline, and the params the
 * session was run with. Exactly what reference/*.evidence.json holds.
 */
export async function sessionReferenceEvidence(sessionId: string) {
  const ctx = await loadSessionCtx(sessionId);
  const runs = await prisma.labCheckRun.findMany({
    where: { sessionId, status: "GRADED" },
    orderBy: { requestedAt: "desc" },
  });
  const run = runs.find((r) => r.final && r.evidence) ?? runs.find((r) => r.evidence);
  if (!run) throw new LabError("no_evidence", "This session has no graded check with evidence yet. Run a check (or end the session) first.", 409);
  const evidence: Evidence = { ...runEvidence(ctx, run), params: ctx.params };
  return { ctx, run, evidence };
}

export type SaveReferenceResult =
  | { ok: true; version: number; draft: boolean; activated: boolean; score: number; maxScore: number }
  | { ok: false; errors: FolderIssue[] };

export async function saveSessionAsReference(sessionId: string, kind: ReferenceKind, byUserId: string): Promise<SaveReferenceResult> {
  const { ctx, run, evidence } = await sessionReferenceEvidence(sessionId);
  const version = ctx.session.labVersion;
  const refs: References = { ...((version.references ?? {}) as References) };
  const graded = gradeLab(ctx.lab, evidence, { params: evidence.params ?? {}, run: "final" });

  if (kind === "good") {
    refs.good = evidence;
  } else {
    // The broken reference's expectations are what this run actually got, so the
    // gate keeps proving the checks fail on an untouched machine.
    const scored = graded.checks.filter((c) => !c.flag && !c.skipped);
    refs.broken = evidence;
    refs.brokenExpect = {
      description: `Captured from ${ctx.session.labVersion.lab.slug} session ${ctx.session.id}${run.final ? "" : " (practice check)"}.`,
      pass: scored.filter((c) => c.passed).map((c) => c.id),
      fail: scored.filter((c) => !c.passed).map((c) => c.id),
      flags: graded.flags,
    };
  }

  const gate = runGate(ctx.lab, refs, { reportMissingGood: false });
  if (gate.errors.length) {
    // A practice check doesn't collect `when: final` steps; say so rather than leave it a mystery.
    const hint = !run.final && ctx.lab.collect.some((s) => s.when === "final")
      ? [{ file: "session", message: "This was a practice check, which skips the lab's final-only steps. End the session so the final check collects everything, then save again." }]
      : [];
    return { ok: false, errors: [...gate.errors, ...hint] };
  }

  const previous = (version.gate ?? {}) as Record<string, unknown>;
  const draft = !gate.references.good;
  const gateRecord: LabFolderReport["gate"] & Record<string, unknown> = {
    ...previous,
    ...gate.gate,
    // The upload's "no good/broken reference" warning no longer applies.
    warnings: ((previous.warnings ?? []) as FolderIssue[]).filter((w) => w.file !== `reference/${kind}.evidence.json`),
    checkedAt: new Date().toISOString(),
    capturedFrom: { ...(previous.capturedFrom as object | undefined), [kind]: { sessionId, runId: run.id } },
  };
  await prisma.labVersion.update({
    where: { id: version.id },
    data: { references: gate.references as object, gate: gateRecord as object, draft },
  });
  await prisma.labAuditEvent.create({
    data: { type: "LAB_REFERENCE_SAVED", userId: byUserId, detail: { labId: version.labId, version: version.version, kind, sessionId, runId: run.id } },
  });
  return { ok: true, version: version.version, draft, activated: version.draft && !draft, score: graded.score, maxScore: graded.maxScore };
}

/** A version's stored reference files, named as in a lab folder. */
export async function versionReferenceFile(labId: string, file: string, versionNumber?: number): Promise<{ name: string; body: unknown } | null> {
  const version = await prisma.labVersion.findFirst({
    where: { labId, ...(versionNumber ? { version: versionNumber } : {}) },
    orderBy: { version: "desc" },
  });
  if (!version) return null;
  const refs = (version.references ?? {}) as References;
  const body = file === "good.evidence.json" ? refs.good
    : file === "broken.evidence.json" ? refs.broken
    : file === "broken.expect.json" ? refs.brokenExpect
    : undefined;
  return body === undefined ? null : { name: file, body };
}
