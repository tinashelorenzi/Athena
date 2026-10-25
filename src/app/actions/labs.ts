"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LabError, cancelSession, endSession, requestCheck, startSession } from "@/lib/labs/sessions";

/* Lab session controls from the lab page (docs/labs/spec.md section 8). The
   same engine serves `zaio start|check|end` through the agent API. */

export type LabActionResult = { error?: string };

async function run(scenarioId: string, fn: () => Promise<unknown>): Promise<LabActionResult> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof LabError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/learn/${scenarioId}`);
  return {};
}

async function sessionScenario(sessionId: string, userId: string): Promise<string | null> {
  const s = await prisma.labSession.findFirst({
    where: { id: sessionId, userId },
    select: { labVersion: { select: { lab: { select: { scenarioId: true } } } } },
  });
  return s?.labVersion.lab.scenarioId ?? null;
}

/** Start a session; `assignments` maps each lab role to one of the user's machines. */
export async function startLab(scenarioId: string, assignments: Record<string, string>): Promise<LabActionResult> {
  const user = await requireUser();
  return run(scenarioId, () => startSession({ userId: user.id, scenarioId, assignments }));
}

export async function checkLab(sessionId: string): Promise<LabActionResult> {
  const user = await requireUser();
  const scenarioId = await sessionScenario(sessionId, user.id);
  if (!scenarioId) return { error: "No such session." };
  return run(scenarioId, () => requestCheck(sessionId, user.id, false));
}

export async function endLab(sessionId: string): Promise<LabActionResult> {
  const user = await requireUser();
  const scenarioId = await sessionScenario(sessionId, user.id);
  if (!scenarioId) return { error: "No such session." };
  return run(scenarioId, () => endSession(sessionId, user.id));
}

export async function cancelLab(sessionId: string): Promise<LabActionResult> {
  const user = await requireUser();
  const scenarioId = await sessionScenario(sessionId, user.id);
  if (!scenarioId) return { error: "No such session." };
  return run(scenarioId, () => cancelSession(sessionId, user.id));
}
