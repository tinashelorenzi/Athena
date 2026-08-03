"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export type AssignResult = { error?: string; count?: number };

/**
 * Assign a scenario to one or more students (instructor-only). Existing
 * (scenario, student) pairs are skipped so re-assigning is idempotent.
 */
export async function assignScenario(
  scenarioId: string,
  studentIds: string[],
  dueAt?: string | null,
): Promise<AssignResult> {
  const instructor = await requireRole("SUPER_ADMIN");

  if (!scenarioId) return { error: "No scenario selected." };
  if (!studentIds || studentIds.length === 0) {
    return { error: "Select at least one student." };
  }

  // Only assign to accounts that are actually students.
  const students = await prisma.user.findMany({
    where: { id: { in: studentIds }, role: "STUDENT" },
    select: { id: true },
  });
  if (students.length === 0) return { error: "No valid students selected." };

  const due = dueAt ? new Date(dueAt) : null;

  const result = await prisma.assignment.createMany({
    data: students.map((s) => ({
      scenarioId,
      studentId: s.id,
      assignedById: instructor.id,
      dueAt: due && !Number.isNaN(due.getTime()) ? due : null,
    })),
    skipDuplicates: true,
  });

  revalidatePath("/admin/assignments");
  return { count: result.count };
}

/** Remove a single scenario assignment. */
export async function unassignScenario(
  assignmentId: string,
): Promise<{ error?: string }> {
  await requireRole("SUPER_ADMIN");

  await prisma.assignment
    .delete({ where: { id: assignmentId } })
    .catch(() => {});

  revalidatePath("/admin/assignments");
  return {};
}
