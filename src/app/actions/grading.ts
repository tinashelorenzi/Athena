"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export type GradeResult = { error?: string; ok?: boolean };

/** Grade a student's scenario submission (instructor-only). */
export async function gradeSubmission(
  submissionId: string,
  grade: number,
  feedback: string,
): Promise<GradeResult> {
  const admin = await requireRole("SUPER_ADMIN");

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, student: { select: { cohortId: true } } },
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
    },
  });

  if (submission.student.cohortId) revalidatePath(`/admin/cohorts/${submission.student.cohortId}`);
  return { ok: true };
}
