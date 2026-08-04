"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isAuthorizedForScenario, publicFlags } from "@/lib/student";

export type SubmitState = { error?: string; ok?: string };

/**
 * Submit (or re-submit) a student's deliverables for a scenario: their flag
 * answers and an optional report. Instructors grade it afterwards.
 */
export async function submitScenario(
  scenarioId: string,
  _prevState: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const user = await requireUser();
  if (user.role !== "STUDENT") return { error: "Only students can submit." };
  if (!(await isAuthorizedForScenario(user.id, scenarioId))) {
    return { error: "You don't have access to this scenario." };
  }

  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: { flags: true, reportRequired: true },
  });
  if (!scenario) return { error: "Scenario not found." };

  // Collect an answer per flag from fields named `flag:<id>`.
  const flags = publicFlags(scenario.flags);
  const flagAnswers: Record<string, string> = {};
  for (const f of flags) {
    flagAnswers[f.id] = String(formData.get(`flag:${f.id}`) ?? "").trim();
  }

  const report = String(formData.get("report") ?? "").trim();
  if (scenario.reportRequired && !report) {
    return { error: "A written report is required for this scenario." };
  }

  await prisma.submission.upsert({
    where: { scenarioId_studentId: { scenarioId, studentId: user.id } },
    update: { flagAnswers, report: report || null, status: "SUBMITTED", submittedAt: new Date() },
    create: { scenarioId, studentId: user.id, flagAnswers, report: report || null },
  });

  revalidatePath(`/learn/${scenarioId}`);
  return { ok: "Deliverables submitted. Your instructor will grade them." };
}
