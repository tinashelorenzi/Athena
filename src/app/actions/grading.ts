"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export type GradeResult = { error?: string; ok?: boolean };

/**
 * Commit a grade for a student's submission (instructor-only). The grade is
 * *held* — it stays hidden from the student until it's released with
 * `releaseGrade`. Re-grading a released submission preserves its released state.
 */
export async function gradeSubmission(
  submissionId: string,
  grade: number,
  feedback: string,
  release = false,
): Promise<GradeResult> {
  const admin = await requireRole("SUPER_ADMIN");

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, releasedAt: true, student: { select: { cohortId: true } } },
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
      feedback: feedback.trim() || null,
      status: "GRADED",
      gradedById: admin.id,
      gradedAt: new Date(),
      // Release now if asked; otherwise keep whatever release state it had.
      ...(release ? { releasedAt: new Date() } : {}),
    },
  });

  if (submission.student.cohortId) revalidatePath(`/admin/cohorts/${submission.student.cohortId}`);
  return { ok: true };
}

/** Release (or re-hide) a committed grade so the student can see it. */
export async function setGradeReleased(
  submissionId: string,
  released: boolean,
): Promise<GradeResult> {
  await requireRole("SUPER_ADMIN");

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

  if (submission.student.cohortId) revalidatePath(`/admin/cohorts/${submission.student.cohortId}`);
  return { ok: true };
}
