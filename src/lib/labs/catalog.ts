import { prisma } from "@/lib/db";
import type { CompiledLab } from "./language/types";
import { ACTIVE_STATUSES } from "./sessions";

/**
 * Labs a user can run: public (non-hidden) labs plus those released to their
 * cohort; instructors see every lab (to test with reference machines).
 */
export type LabListing = {
  scenarioId: string;
  slug: string;
  title: string;
  type: "DOJO" | "ASSESSMENT";
  roles: string[];
  activeSessionId: string | null;
  activeStatus: string | null;
};

export async function listLabsForUser(userId: string): Promise<LabListing[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, cohortId: true } });
  if (!user) return [];
  const where =
    user.role === "SUPER_ADMIN"
      ? { kind: "LAB" as const }
      : {
          kind: "LAB" as const,
          lab: { versions: { some: { draft: false } } },
          OR: [
            { exposure: "PUBLIC" as const, hidden: false },
            ...(user.cohortId ? [{ cohorts: { some: { cohortId: user.cohortId } } }] : []),
          ],
        };
  const scenarios = await prisma.scenario.findMany({
    where,
    orderBy: { title: "asc" },
    select: {
      id: true, title: true, type: true,
      lab: { select: { slug: true, versions: { where: user.role === "SUPER_ADMIN" ? {} : { draft: false }, orderBy: { version: "desc" }, take: 1, select: { definition: true } } } },
    },
  });
  const sessions = await prisma.labSession.findMany({
    where: { userId, status: { in: [...ACTIVE_STATUSES] } },
    select: { id: true, status: true, labVersion: { select: { lab: { select: { scenarioId: true } } } } },
  });
  return scenarios
    .filter((s) => s.lab && s.lab.versions.length)
    .map((s) => {
      const active = sessions.find((x) => x.labVersion.lab.scenarioId === s.id);
      return {
        scenarioId: s.id,
        slug: s.lab!.slug,
        title: s.title,
        type: s.type,
        roles: Object.keys((s.lab!.versions[0].definition as unknown as CompiledLab).machines),
        activeSessionId: active?.id ?? null,
        activeStatus: active?.status ?? null,
      };
    });
}
