import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

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
  scenarioId: string;
  scenarioTitle: string;
  scenarioType: "DOJO" | "ASSESSMENT";
  /** LAB scenarios: the lab session this submission came from. */
  labSessionId: string | null;
  submitted: string;
  status: "SUBMITTED" | "GRADED";
  grade: number | null;
  released: boolean;
  committed: boolean;
  feedback: string;
  report: string;
  reportFileName: string;
  flagReview: FlagReview[];
  flagsCorrect: number;
  flagsTotal: number;
  /** Suggested grade auto-marked from flag correctness (0–100), or null if there
   *  are no flags to mark. Instructors validate/override before releasing. */
  autoGrade: number | null;
  /** Human label for the auto-mark basis, e.g. "8/10 pts" or "3/5 flags". */
  autoBasis: string;
};

type FlagDef = { id?: string; question?: string; answer?: string; points?: number };

export async function getGradingQueue(where?: Prisma.SubmissionWhereInput, take?: number): Promise<QueueItem[]> {
  const subs = await prisma.submission.findMany({
    where,
    take,
    orderBy: [{ submittedAt: "desc" }],
    include: {
      student: { select: { name: true, cohort: { select: { id: true, name: true } } } },
      scenario: { select: { title: true, type: true, flags: true } },
      labSession: { select: { score: true, overrideScore: true, maxScore: true, flags: true, endedAt: true } },
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

    // Auto-mark from flags: prefer weighted points, else fall back to a plain
    // correct/total count. Null when there are no flags to mark (report-only).
    const flagsCorrect = flagReview.filter((f) => f.correct).length;
    const flagsTotal = flagReview.length;
    const totalPoints = flagReview.reduce((a, f) => a + f.points, 0);
    const correctPoints = flagReview.filter((f) => f.correct).reduce((a, f) => a + f.points, 0);
    let autoGrade: number | null = null;
    let autoBasis = "";
    if (s.labSession?.maxScore) {
      // Labs: the final check of the session that produced this submission.
      const labScore = s.labSession.overrideScore ?? s.labSession.score ?? 0;
      autoGrade = Math.round((labScore / s.labSession.maxScore) * 100);
      autoBasis = `lab ${labScore}/${s.labSession.maxScore}${s.labSession.overrideScore != null ? " (adjusted)" : ""}${s.labSession.flags.length ? ` · flagged: ${s.labSession.flags.join(", ")}` : ""}`;
    } else if (flagsTotal > 0) {
      if (totalPoints > 0) {
        autoGrade = Math.round((correctPoints / totalPoints) * 100);
        autoBasis = `${correctPoints}/${totalPoints} pts`;
      } else {
        autoGrade = Math.round((flagsCorrect / flagsTotal) * 100);
        autoBasis = `${flagsCorrect}/${flagsTotal} flags`;
      }
    }

    return {
      id: s.id,
      studentId: s.studentId,
      studentName: s.student.name,
      cohortId: s.student.cohort?.id ?? null,
      cohortName: s.student.cohort?.name ?? "—",
      scenarioId: s.scenarioId,
      scenarioTitle: s.scenario.title,
      scenarioType: s.scenario.type as "DOJO" | "ASSESSMENT",
      labSessionId: s.labSessionId,
      submitted: s.submittedAt.toISOString(),
      status: s.status,
      grade: s.grade,
      released: s.releasedAt != null,
      committed: s.committedAt != null,
      feedback: s.feedback || "",
      report: s.report || "",
      reportFileName: s.reportFileName || "",
      flagReview,
      flagsCorrect,
      flagsTotal,
      autoGrade,
      autoBasis,
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

/*
 * Grading changes, made as `actorId` (an instructor). Shared by the grading
 * Server Actions and the MCP server (docs/mcp.md); callers check the role and
 * revalidate `/admin/cohorts/<cohortId>`.
 */
export type GradeChange = { error?: string; ok?: boolean; cohortId?: string | null };

/**
 * Commit a grade (0–100) for a submission. The grade is *held*, hidden from the
 * student until it's released; re-grading a released submission keeps it released.
 */
export async function gradeSubmissionAs(actorId: string, submissionId: string, grade: number, feedback: string, release = false): Promise<GradeChange> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, releasedAt: true, committedAt: true, student: { select: { cohortId: true } } },
  });
  if (!submission) return { error: "Submission not found." };

  const numeric = Math.round(Number(grade));
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    return { error: "Grade must be between 0 and 100." };
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      grade: numeric,
      feedback: String(feedback ?? "").trim() || null,
      status: "GRADED",
      gradedById: actorId,
      gradedAt: new Date(),
      // Grading locks the submission: commit it if it wasn't already.
      ...(submission.committedAt ? {} : { committedAt: new Date(), committedById: actorId }),
      // Release now if asked; otherwise keep whatever release state it had.
      ...(release ? { releasedAt: new Date() } : {}),
    },
  });
  return { ok: true, cohortId: submission.student.cohortId };
}

/**
 * Commit (lock) a submission for grading, or re-open it so the student can
 * re-do. A released submission can't be re-opened without un-releasing first.
 */
export async function setSubmissionCommittedAs(actorId: string, submissionId: string, committed: boolean): Promise<GradeChange> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, releasedAt: true, student: { select: { cohortId: true } } },
  });
  if (!submission) return { error: "Submission not found." };
  if (!committed && submission.releasedAt) {
    return { error: "Un-release the grade before re-opening the submission." };
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: committed
      ? { committedAt: new Date(), committedById: actorId }
      : { committedAt: null, committedById: null },
  });
  return { ok: true, cohortId: submission.student.cohortId };
}

/** Release (or re-hide) a committed grade so the student can see it. */
export async function setGradeReleasedAs(submissionId: string, released: boolean): Promise<GradeChange> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true, grade: true, student: { select: { cohortId: true } } },
  });
  if (!submission) return { error: "Submission not found." };
  if (released && (submission.status !== "GRADED" || submission.grade == null)) {
    return { error: "Commit a grade before releasing it." };
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: { releasedAt: released ? new Date() : null },
  });
  return { ok: true, cohortId: submission.student.cohortId };
}
