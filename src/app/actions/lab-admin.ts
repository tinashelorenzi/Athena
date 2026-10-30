"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireArchitect, requireRole } from "@/lib/auth";
import { applyRegrade, getSessionDetail, previewRegrade, setScoreOverride, type RegradeDiff, type RegradeTarget, type SessionDetail } from "@/lib/labs/admin";
import { editorSources, publishEdit, runEditor, type EditorRun, type EditorSource, type PublishResult } from "@/lib/labs/editor";
import { LabError } from "@/lib/labs/sessions";
import { saveSessionAsReference, type ReferenceKind, type SaveReferenceResult } from "@/lib/labs/reference";
import { briefScriptNames, normalizeScript, validateScript } from "@/lib/labs/scripts";
import type { CompiledLab } from "@/lib/labs/language/types";

/* Instructor lab tools (docs/labs/spec.md 12–13). Viewing, overriding and
   re-grading need an instructor; editing checks needs an architect. */

type Err = { error: string };

async function guard<T>(fn: () => Promise<T>): Promise<T | Err> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof LabError) return { error: e.message };
    throw e;
  }
}

async function scenarioOfLab(labId: string): Promise<string | null> {
  return (await prisma.lab.findUnique({ where: { id: labId }, select: { scenarioId: true } }))?.scenarioId ?? null;
}

export async function labSessionDetail(sessionId: string): Promise<SessionDetail | Err> {
  await requireRole("SUPER_ADMIN");
  return (await getSessionDetail(sessionId)) ?? { error: "No such session." };
}

export async function overrideLabScore(sessionId: string, score: number | null, reason: string): Promise<{ ok: true } | Err> {
  const user = await requireRole("SUPER_ADMIN");
  return guard(async () => {
    await setScoreOverride(sessionId, score, reason, user.id);
    const s = await prisma.labSession.findUnique({ where: { id: sessionId }, select: { labVersion: { select: { lab: { select: { scenarioId: true } } } } } });
    if (s) revalidatePath(`/admin/scenarios/${s.labVersion.lab.scenarioId}`);
    revalidatePath("/admin/grading");
    return { ok: true as const };
  });
}

export async function previewLabRegrade(labId: string, target: RegradeTarget, sessionIds?: string[]): Promise<RegradeDiff[] | Err> {
  await requireRole("SUPER_ADMIN");
  return guard(() => previewRegrade(labId, target, sessionIds));
}

export async function applyLabRegrade(labId: string, target: RegradeTarget, sessionIds?: string[]): Promise<{ changed: number } | Err> {
  const user = await requireRole("SUPER_ADMIN");
  return guard(async () => {
    const changed = await applyRegrade(labId, target, sessionIds, user.id);
    const scenarioId = await scenarioOfLab(labId);
    if (scenarioId) revalidatePath(`/admin/scenarios/${scenarioId}`);
    revalidatePath("/admin/grading");
    return { changed };
  });
}

export async function labEditorSources(labId: string) {
  await requireArchitect();
  return guard(() => editorSources(labId));
}

export async function runLabEditor(labId: string, yaml: string, source: EditorSource): Promise<EditorRun | Err> {
  await requireArchitect();
  return guard(() => runEditor(labId, yaml, source));
}

export async function publishLabEdit(labId: string, yaml: string): Promise<PublishResult | Err> {
  const user = await requireArchitect();
  return guard(async () => {
    const res = await publishEdit(labId, yaml, user.id);
    if (res.ok) {
      const scenarioId = await scenarioOfLab(labId);
      if (scenarioId) revalidatePath(`/admin/scenarios/${scenarioId}`);
    }
    return res;
  });
}

/** Who can see a lab — set from its page, and kept across re-uploads. */
export async function setLabVisibility(scenarioId: string, exposure: "ROLLOUT" | "PUBLIC", hidden: boolean): Promise<{ ok: true } | Err> {
  await requireArchitect();
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId }, select: { kind: true, type: true } });
  if (scenario?.kind !== "LAB") return { error: "No such lab." };
  await prisma.scenario.update({
    where: { id: scenarioId },
    // Hidden is a Dojo-only idea, as for SOC scenarios: assessments are always listed to their cohorts.
    data: { exposure: exposure === "PUBLIC" ? "PUBLIC" : "ROLLOUT", hidden: scenario.type === "DOJO" && hidden },
  });
  revalidatePath(`/admin/scenarios/${scenarioId}`);
  revalidatePath("/admin/scenarios");
  return { ok: true };
}

/** Release a lab to exactly these cohorts (adds and removes bindings). */
export async function setLabCohorts(scenarioId: string, cohortIds: string[]): Promise<{ ok: true } | Err> {
  const user = await requireArchitect();
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId }, select: { kind: true } });
  if (scenario?.kind !== "LAB") return { error: "No such lab." };
  const wanted = (await prisma.cohort.findMany({ where: { id: { in: cohortIds } }, select: { id: true } })).map((c) => c.id);
  const current = (await prisma.cohortScenario.findMany({ where: { scenarioId }, select: { cohortId: true } })).map((b) => b.cohortId);
  const added = wanted.filter((id) => !current.includes(id));
  const removed = current.filter((id) => !wanted.includes(id));
  await prisma.$transaction([
    prisma.cohortScenario.deleteMany({ where: { scenarioId, cohortId: { in: removed } } }),
    prisma.cohortScenario.createMany({ data: added.map((cohortId) => ({ cohortId, scenarioId, boundById: user.id })), skipDuplicates: true }),
  ]);
  revalidatePath(`/admin/scenarios/${scenarioId}`);
  for (const id of [...added, ...removed]) revalidatePath(`/admin/cohorts/${id}`);
  return { ok: true };
}

/** Save a session's evidence as its lab version's good or broken reference. */
export async function saveLabReference(sessionId: string, kind: ReferenceKind): Promise<SaveReferenceResult | Err> {
  const user = await requireArchitect();
  return guard(async () => {
    const res = await saveSessionAsReference(sessionId, kind === "broken" ? "broken" : "good", user.id);
    if (res.ok) {
      const s = await prisma.labSession.findUnique({ where: { id: sessionId }, select: { labVersion: { select: { lab: { select: { scenarioId: true } } } } } });
      if (s) revalidatePath(`/admin/scenarios/${s.labVersion.lab.scenarioId}`);
      revalidatePath("/admin/scenarios");
    }
    return res;
  });
}

/**
 * Add or replace a lab script typed or uploaded on the lab page (docs/labs/scripts.md).
 * `create` refuses to overwrite an existing script of that name.
 */
export async function saveLabScript(labId: string, name: string, content: string, create: boolean): Promise<{ ok: true } | Err> {
  const user = await requireArchitect();
  const lab = await prisma.lab.findUnique({
    where: { id: labId },
    select: { scenarioId: true, versions: { orderBy: { version: "desc" }, take: 1, select: { definition: true } } },
  });
  if (!lab) return { error: "No such lab." };
  name = String(name ?? "").trim().replace(/\.sh$/, "");
  content = normalizeScript(String(content ?? ""));
  const params = (lab.versions[0]?.definition as unknown as CompiledLab | undefined)?.params ?? null;
  const problems = validateScript(name, content, params);
  if (problems.length) return { error: problems.join("; ") };
  if (create && (await prisma.labScript.findUnique({ where: { labId_name: { labId, name } }, select: { id: true } }))) {
    return { error: `This lab already has a script called "${name}". Edit that one, or pick another name.` };
  }
  await prisma.labScript.upsert({
    where: { labId_name: { labId, name } },
    update: { content, updatedById: user.id },
    create: { labId, name, content, updatedById: user.id },
  });
  revalidatePath(`/admin/scenarios/${lab.scenarioId}`);
  return { ok: true };
}

/** Delete a lab script; refused while the brief still hands it out. Students' links stop working. */
export async function deleteLabScript(labId: string, name: string): Promise<{ ok: true } | Err> {
  await requireArchitect();
  const lab = await prisma.lab.findUnique({ where: { id: labId }, select: { scenarioId: true, scenario: { select: { brief: true } } } });
  if (!lab) return { error: "No such lab." };
  if (briefScriptNames(lab.scenario.brief).includes(name)) {
    return { error: `The brief still uses {{script.${name}}}. Take it out of brief.md and re-upload the folder first.` };
  }
  await prisma.labScript.deleteMany({ where: { labId, name } });
  revalidatePath(`/admin/scenarios/${lab.scenarioId}`);
  return { ok: true };
}
