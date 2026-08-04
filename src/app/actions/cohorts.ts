"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export type CohortResult = { error?: string; cohort?: { id: string; name: string } };

/** Create a cohort. Returns the new cohort (or an error if the name is taken). */
export async function createCohort(name: string): Promise<CohortResult> {
  const admin = await requireRole("SUPER_ADMIN");
  const trimmed = name.trim();
  if (!trimmed) return { error: "Cohort name is required." };

  const existing = await prisma.cohort.findUnique({ where: { name: trimmed } });
  if (existing) return { error: `A cohort named "${trimmed}" already exists.` };

  const cohort = await prisma.cohort.create({ data: { name: trimmed, createdById: admin.id } });
  revalidatePath("/admin/cohorts");
  return { cohort: { id: cohort.id, name: cohort.name } };
}

export async function deleteCohort(cohortId: string): Promise<{ error?: string }> {
  await requireRole("SUPER_ADMIN");
  // Detaching students happens automatically (User.cohortId is SetNull).
  await prisma.cohort.delete({ where: { id: cohortId } }).catch(() => {});
  revalidatePath("/admin/cohorts");
  redirect("/admin/cohorts");
}

/** Bind one or more authored scenarios to a cohort (idempotent). */
export async function bindScenarios(
  cohortId: string,
  scenarioIds: string[],
): Promise<{ error?: string; count?: number }> {
  const admin = await requireRole("SUPER_ADMIN");
  if (!scenarioIds?.length) return { error: "Select at least one scenario." };

  const scenarios = await prisma.scenario.findMany({
    where: { id: { in: scenarioIds } },
    select: { id: true },
  });
  if (!scenarios.length) return { error: "No valid scenarios selected." };

  const result = await prisma.cohortScenario.createMany({
    data: scenarios.map((s) => ({ cohortId, scenarioId: s.id, boundById: admin.id })),
    skipDuplicates: true,
  });
  revalidatePath(`/admin/cohorts/${cohortId}`);
  return { count: result.count };
}

export async function unbindScenario(bindingId: string): Promise<{ error?: string }> {
  await requireRole("SUPER_ADMIN");
  const binding = await prisma.cohortScenario.findUnique({ where: { id: bindingId } });
  await prisma.cohortScenario.delete({ where: { id: bindingId } }).catch(() => {});
  if (binding) revalidatePath(`/admin/cohorts/${binding.cohortId}`);
  return {};
}

/** Remove a student from a cohort (does not delete the account). */
export async function removeFromCohort(studentId: string, cohortId: string): Promise<{ error?: string }> {
  await requireRole("SUPER_ADMIN");
  await prisma.user.update({ where: { id: studentId }, data: { cohortId: null } }).catch(() => {});
  revalidatePath(`/admin/cohorts/${cohortId}`);
  return {};
}
