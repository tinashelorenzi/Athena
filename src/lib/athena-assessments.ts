import { prisma } from "@/lib/db";

export type CohortAssessmentRow = {
  scenarioId: string;
  refToken: string | null;
  title: string;
  grade: number | null;
  releasedAt: string;
  submittedAt: string;
};

export type CohortStudentAssessmentsResult =
  | { ok: true; assessments: CohortAssessmentRow[] }
  | { ok: false; error: string };

/**
 * Released, graded ASSESSMENT submissions for a student in a cohort (cohort-bound scenarios only).
 */
export async function getCohortStudentAssessments(
  cohortId: string,
  zaioUserId: string,
): Promise<CohortStudentAssessmentsResult> {
  const cohort = await prisma.cohort.findUnique({ where: { id: cohortId }, select: { id: true } });
  if (!cohort) return { ok: false, error: "Cohort not found." };

  const zaioId = String(zaioUserId || "").trim();
  if (!zaioId) return { ok: false, error: "zaioUserId is required." };

  const user = await prisma.user.findFirst({
    where: { zaioUserId: zaioId, cohortId },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "Student not found in this cohort." };

  const bindings = await prisma.cohortScenario.findMany({
    where: { cohortId },
    include: { scenario: { select: { id: true, title: true, type: true, refToken: true } } },
  });

  const assessmentScenarioIds = bindings
    .filter((b) => b.scenario.type === "ASSESSMENT")
    .map((b) => b.scenario.id);

  if (assessmentScenarioIds.length === 0) {
    return { ok: true, assessments: [] };
  }

  const subs = await prisma.submission.findMany({
    where: {
      studentId: user.id,
      scenarioId: { in: assessmentScenarioIds },
      status: "GRADED",
      releasedAt: { not: null },
    },
    orderBy: { releasedAt: "desc" },
    include: { scenario: { select: { id: true, title: true, refToken: true } } },
  });

  return {
    ok: true,
    assessments: subs.map((s) => ({
      scenarioId: s.scenarioId,
      refToken: s.scenario.refToken,
      title: s.scenario.title,
      grade: s.grade,
      releasedAt: (s.releasedAt as Date).toISOString(),
      submittedAt: s.submittedAt.toISOString(),
    })),
  };
}
