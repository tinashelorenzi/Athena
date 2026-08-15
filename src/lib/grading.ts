import { prisma } from "@/lib/db";

/**
 * Instructor grading data (server-only). Aggregates submissions across ALL
 * cohorts so instructors can work a single queue: grade what's pending, then
 * release (or hold) results. Flag correctness is computed here (answers are
 * server-only and never sent to students).
 */
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export type FlagReview = { question: string; answer: string; correct: boolean; points: number };

export type QueueItem = {
  id: string;
  studentId: string;
  studentName: string;
  cohortId: string | null;
  cohortName: string;
  scenarioTitle: string;
  scenarioType: "DOJO" | "ASSESSMENT";
  submitted: string;
  status: "SUBMITTED" | "GRADED";
  grade: number | null;
  released: boolean;
  feedback: string;
  report: string;
  reportFileName: string;
  flagReview: FlagReview[];
  flagsCorrect: number;
  flagsTotal: number;
};

type FlagDef = { id?: string; question?: string; answer?: string; points?: number };

export async function getGradingQueue(): Promise<QueueItem[]> {
  const subs = await prisma.submission.findMany({
    orderBy: [{ submittedAt: "desc" }],
    include: {
      student: { select: { name: true, cohort: { select: { id: true, name: true } } } },
      scenario: { select: { title: true, type: true, flags: true } },
    },
  });

  return subs.map((s) => {
    const answers = (s.flagAnswers ?? {}) as Record<string, string>;
    const flags = (Array.isArray(s.scenario.flags) ? s.scenario.flags : []) as FlagDef[];
    const flagReview: FlagReview[] = flags.map((f, i) => {
      const id = String(f?.id ?? `f${i + 1}`);
      const answer = answers[id] ?? "";
      return { question: f?.question ?? "", answer, correct: Boolean(answer) && norm(answer) === norm(f?.answer), points: f?.points || 0 };
    });
    return {
      id: s.id,
      studentId: s.studentId,
      studentName: s.student.name,
      cohortId: s.student.cohort?.id ?? null,
      cohortName: s.student.cohort?.name ?? "—",
      scenarioTitle: s.scenario.title,
      scenarioType: s.scenario.type as "DOJO" | "ASSESSMENT",
      submitted: s.submittedAt.toISOString(),
      status: s.status,
      grade: s.grade,
      released: s.releasedAt != null,
      feedback: s.feedback || "",
      report: s.report || "",
      reportFileName: s.reportFileName || "",
      flagReview,
      flagsCorrect: flagReview.filter((f) => f.correct).length,
      flagsTotal: flagReview.length,
    };
  });
}

export type GradingStats = { needsGrading: number; held: number; released: number; total: number };

export async function getGradingStats(): Promise<GradingStats> {
  const [needsGrading, held, released] = await Promise.all([
    prisma.submission.count({ where: { status: "SUBMITTED" } }),
    prisma.submission.count({ where: { status: "GRADED", releasedAt: null } }),
    prisma.submission.count({ where: { status: "GRADED", releasedAt: { not: null } } }),
  ]);
  return { needsGrading, held, released, total: needsGrading + held + released };
}
