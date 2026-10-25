"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireArchitect, requireRole } from "@/lib/auth";
import { applyRegrade, getSessionDetail, previewRegrade, setScoreOverride, type RegradeDiff, type RegradeTarget, type SessionDetail } from "@/lib/labs/admin";
import { editorSources, publishEdit, runEditor, type EditorRun, type EditorSource, type PublishResult } from "@/lib/labs/editor";
import { LabError } from "@/lib/labs/sessions";

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
