import { prisma } from "@/lib/db";
import { drawParams, type ParamValues } from "./language/params";
import type { CompiledLab } from "./language/types";

/**
 * Stored per-student parameters (LabParam). Generated on first use against the
 * lab's latest version and never changed afterwards, so a student's values stay
 * stable across sessions and re-uploads. New params added by a later version
 * are drawn and merged in.
 */
export async function getOrCreateLabParams(labId: string, userId: string, lab: CompiledLab): Promise<ParamValues> {
  const existing = await prisma.labParam.findUnique({ where: { labId_userId: { labId, userId } } });
  const current = (existing?.values ?? {}) as ParamValues;
  const missing = Object.fromEntries(Object.entries(lab.params).filter(([n]) => current[n] === undefined));
  if (!Object.keys(missing).length) return current;

  // Values already used in the student's cohort, for `unique: cohort` params.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { cohortId: true } });
  const taken: Record<string, Set<string>> = {};
  if (Object.values(missing).some((s) => s.unique) && user?.cohortId) {
    const peers = await prisma.labParam.findMany({
      where: { labId, userId: { not: userId }, user: { cohortId: user.cohortId } },
      select: { values: true },
    });
    for (const row of peers) {
      for (const [k, v] of Object.entries(row.values as ParamValues)) (taken[k] ??= new Set()).add(String(v));
    }
  }

  const values = { ...current, ...drawParams(missing, taken) };
  await prisma.labParam.upsert({
    where: { labId_userId: { labId, userId } },
    update: { values },
    create: { labId, userId, values },
  });
  return values;
}
