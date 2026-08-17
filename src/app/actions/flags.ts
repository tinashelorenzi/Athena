"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isAuthorizedForScenario } from "@/lib/student";
import { normalizeAnswer } from "@/lib/guide";
import { completeRunFor } from "@/lib/run-engine";
import { notifyZaioDojoComplete } from "@/lib/zaio-webhook";

export type FlagCheckResult = { correct: boolean; error?: string };

async function maybeCompleteDojoAndNotifyZaio(
  scenarioId: string,
  studentId: string,
  totalFlags: number,
  solvedBefore: number,
) {
  if (totalFlags <= 0) return;

  const solvedAfter = await prisma.flagSolve.count({
    where: { scenarioId, studentId },
  });

  if (solvedAfter < totalFlags || solvedBefore >= totalFlags) return;

  await completeRunFor(studentId, scenarioId);

  const [student, scenario, solves] = await Promise.all([
    prisma.user.findUnique({ where: { id: studentId }, select: { zaioUserId: true } }),
    prisma.scenario.findUnique({ where: { id: scenarioId }, select: { refToken: true, flags: true } }),
    prisma.flagSolve.findMany({
      where: { scenarioId, studentId },
      select: { flagId: true },
    }),
  ]);

  if (!student?.zaioUserId || !scenario?.refToken) return;

  const flags = Array.isArray(scenario.flags)
    ? (scenario.flags as { id?: string; points?: number }[])
    : [];
  const solvedIds = new Set(solves.map((s) => s.flagId));
  let score = 0;
  let maxScore = 0;
  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i];
    const flagId = String(flag?.id ?? `f${i + 1}`);
    const points = Number(flag?.points) || 0;
    maxScore += points;
    if (solvedIds.has(flagId)) score += points;
  }

  await notifyZaioDojoComplete({
    zaioUserId: student.zaioUserId,
    refToken: scenario.refToken,
    scenarioId,
    score,
    maxScore,
  });
}

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
    select: { type: true, flags: true, refToken: true },
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

  const solvedBefore = await prisma.flagSolve.count({
    where: { scenarioId, studentId: user.id },
  });

  await prisma.flagSolve
    .upsert({
      where: { scenarioId_studentId_flagId: { scenarioId, studentId: user.id, flagId } },
      update: {},
      create: { scenarioId, studentId: user.id, flagId },
    })
    .catch(() => {});

  await maybeCompleteDojoAndNotifyZaio(scenarioId, user.id, flags.length, solvedBefore);

  return { correct: true };
}
