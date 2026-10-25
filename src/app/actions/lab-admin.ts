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
