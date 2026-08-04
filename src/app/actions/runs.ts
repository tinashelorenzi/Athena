"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isAuthorizedForScenario } from "@/lib/student";
import { computeElapsed } from "@/lib/run-engine";

export type RunState = {
  error?: string;
  status?: "RUNNING" | "PAUSED" | "COMPLETED";
  elapsed?: number;
};

async function authStudent(scenarioId: string) {
  const user = await requireUser();
  if (user.role !== "STUDENT") return { error: "Only students run scenarios." as const };
  if (!(await isAuthorizedForScenario(user.id, scenarioId))) {
    return { error: "You don't have access to this scenario." as const };
  }
  return { user };
}

/** Start (or resume/restart) a run — "hit Run to begin". Sets it RUNNING. */
export async function startRun(scenarioId: string): Promise<RunState> {
  const a = await authStudent(scenarioId);
  if ("error" in a) return { error: a.error };

  const existing = await prisma.scenarioRun.findUnique({
    where: { scenarioId_studentId: { scenarioId, studentId: a.user.id } },
  });

  if (!existing) {
    const run = await prisma.scenarioRun.create({
      data: { scenarioId, studentId: a.user.id, status: "RUNNING", runningSince: new Date() },
    });
    return { status: "RUNNING", elapsed: computeElapsed(run) };
  }

  if (existing.status === "RUNNING") {
    return { status: "RUNNING", elapsed: computeElapsed(existing) };
  }

  // Paused or completed → resume the clock from where it stood.
  const run = await prisma.scenarioRun.update({
    where: { id: existing.id },
    data: { status: "RUNNING", runningSince: new Date() },
  });
  return { status: "RUNNING", elapsed: computeElapsed(run) };
}

/** Pause a run — dojos only (assessments run to the end). */
export async function pauseRun(scenarioId: string): Promise<RunState> {
  const a = await authStudent(scenarioId);
  if ("error" in a) return { error: a.error };

  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId }, select: { type: true } });
  if (scenario?.type === "ASSESSMENT") {
    return { error: "Assessments can't be paused — they run to the end." };
  }

  const run = await prisma.scenarioRun.findUnique({
    where: { scenarioId_studentId: { scenarioId, studentId: a.user.id } },
  });
  if (!run || run.status !== "RUNNING") {
    return { status: run?.status ?? "PAUSED", elapsed: run ? computeElapsed(run) : 0 };
  }

  const banked = computeElapsed(run); // active seconds so far
  const updated = await prisma.scenarioRun.update({
    where: { id: run.id },
    data: { status: "PAUSED", accumulatedSeconds: banked, runningSince: null },
  });
  return { status: "PAUSED", elapsed: computeElapsed(updated) };
}

/** Resume a paused run. */
export async function resumeRun(scenarioId: string): Promise<RunState> {
  const a = await authStudent(scenarioId);
  if ("error" in a) return { error: a.error };

  const run = await prisma.scenarioRun.findUnique({
    where: { scenarioId_studentId: { scenarioId, studentId: a.user.id } },
  });
  if (!run) return { error: "No run to resume." };
  if (run.status === "RUNNING") return { status: "RUNNING", elapsed: computeElapsed(run) };

  const updated = await prisma.scenarioRun.update({
    where: { id: run.id },
    data: { status: "RUNNING", runningSince: new Date() },
  });
  return { status: "RUNNING", elapsed: computeElapsed(updated) };
}
