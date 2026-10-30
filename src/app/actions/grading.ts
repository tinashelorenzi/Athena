"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { gradeSubmissionAs, setGradeReleasedAs, setSubmissionCommittedAs, type GradeChange } from "@/lib/grading";

export type GradeResult = { error?: string; ok?: boolean };

/* Instructor grading. The rules live in src/lib/grading.ts, shared with the
   MCP server (docs/mcp.md). */

function done(res: GradeChange): GradeResult {
  if (res.error) return { error: res.error };
  if (res.cohortId) revalidatePath(`/admin/cohorts/${res.cohortId}`);
  return { ok: true };
}

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
  return done(await gradeSubmissionAs(admin.id, submissionId, grade, feedback, release));
}

/**
 * Commit (lock) a submission for grading, or re-open it so the student can
 * re-do. A released submission can't be re-opened without un-releasing first.
 */
export async function setSubmissionCommitted(
  submissionId: string,
  committed: boolean,
): Promise<GradeResult> {
  const admin = await requireRole("SUPER_ADMIN");
  return done(await setSubmissionCommittedAs(admin.id, submissionId, committed));
}

/** Release (or re-hide) a committed grade so the student can see it. */
export async function setGradeReleased(
  submissionId: string,
  released: boolean,
): Promise<GradeResult> {
  await requireRole("SUPER_ADMIN");
  return done(await setGradeReleasedAs(submissionId, released));
}
