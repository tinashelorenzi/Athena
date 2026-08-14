"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isAuthorizedForScenario } from "@/lib/student";
import { normalizeAnswer } from "@/lib/guide";

export type FlagCheckResult = { correct: boolean; error?: string };

/**
 * Check a student's answer to a single Dojo scenario flag (CTF-style, checked
 * individually rather than at submission). Persists correct solves. Assessment
 * flags are graded by an instructor, so per-flag checking is refused for them.
 */
export async function checkFlag(
  scenarioId: string,
  flagId: string,
  answer: string,
): Promise<FlagCheckResult> {
  const user = await requireUser();
  if (user.role !== "STUDENT") return { correct: false, error: "Only students answer flags." };
  if (!(await isAuthorizedForScenario(user.id, scenarioId))) {
    return { correct: false, error: "You don't have access to this scenario." };
  }

  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: { type: true, flags: true },
  });
  if (!scenario) return { correct: false, error: "Scenario not found." };
  if (scenario.type !== "DOJO") {
    return { correct: false, error: "Assessment flags are graded, not self-checked." };
  }

  const flags = Array.isArray(scenario.flags)
    ? (scenario.flags as { id?: string; answer?: string }[])
    : [];
  const flag = flags.find((f, i) => String(f?.id ?? `f${i + 1}`) === flagId);
  if (!flag) return { correct: false, error: "Unknown flag." };

  if (normalizeAnswer(answer) !== normalizeAnswer(String(flag.answer ?? ""))) {
    return { correct: false };
  }

  await prisma.flagSolve
    .upsert({
      where: { scenarioId_studentId_flagId: { scenarioId, studentId: user.id, flagId } },
      update: {},
      create: { scenarioId, studentId: user.id, flagId },
    })
    .catch(() => {});
  return { correct: true };
}
