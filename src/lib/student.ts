import { prisma } from "@/lib/db";

/**
 * Student-facing scenario access (server-only). Authorization rule: a student
 * may see/enter a scenario only if their cohort is bound to it (CohortScenario).
 * Flag *answers* are never returned to students — strip before sending to the
 * client with `publicFlags()`.
 */
export type StudentScenarioStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SUBMITTED" | "GRADED";

export type StudentScenarioCard = {
  id: string;
  title: string;
  type: "DOJO" | "ASSESSMENT";
  description: string;
  status: StudentScenarioStatus;
  grade: number | null;
};

export async function getStudentScenarios(userId: string): Promise<StudentScenarioCard[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { cohortId: true } });

  const cardSelect = { id: true, title: true, type: true, description: true } as const;

  // A student sees: PUBLIC scenarios (everyone, no binding needed) + the
  // restricted (ROLLOUT) scenarios bound to their cohort. `hidden` scenarios are
  // link-only and stay out of the listing.
  const [bindings, publicScenarios] = await Promise.all([
    user?.cohortId
      ? prisma.cohortScenario.findMany({
          where: { cohortId: user.cohortId },
          include: { scenario: { select: cardSelect } },
          orderBy: { releasedAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.scenario.findMany({
      where: { exposure: "PUBLIC", hidden: false },
      select: cardSelect,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Merge unique (cohort-bound first, then public not already listed).
  const scenarioMap = new Map<string, { id: string; title: string; type: string; description: string }>();
  for (const b of bindings) scenarioMap.set(b.scenario.id, b.scenario);
  for (const s of publicScenarios) if (!scenarioMap.has(s.id)) scenarioMap.set(s.id, s);

  const scenarios = [...scenarioMap.values()];
  if (scenarios.length === 0) return [];
  const scenarioIds = scenarios.map((s) => s.id);

  const [progress, submissions, runs] = await Promise.all([
    prisma.scenarioProgress.findMany({ where: { studentId: userId, scenarioId: { in: scenarioIds } }, select: { scenarioId: true } }),
    prisma.submission.findMany({ where: { studentId: userId, scenarioId: { in: scenarioIds } }, select: { scenarioId: true, status: true, grade: true, releasedAt: true } }),
    prisma.scenarioRun.findMany({ where: { studentId: userId, scenarioId: { in: scenarioIds } }, select: { scenarioId: true, status: true } }),
  ]);
  const started = new Set(progress.map((p) => p.scenarioId));
  const subMap = new Map(submissions.map((s) => [s.scenarioId, s]));
  const runMap = new Map(runs.map((r) => [r.scenarioId, r.status]));

  return scenarios.map((sc) => {
    const sub = subMap.get(sc.id);
    const runStatus = runMap.get(sc.id);
    // A grade stays hidden (shows as "Submitted") until the instructor releases it.
    const released = Boolean(sub && sub.status === "GRADED" && sub.releasedAt != null);
    let status: StudentScenarioStatus;
    if (sub) status = released ? "GRADED" : "SUBMITTED";
    else if (runStatus === "COMPLETED") status = "COMPLETED";
    else if (runStatus || started.has(sc.id)) status = "IN_PROGRESS";
    else status = "NOT_STARTED";
    return {
      id: sc.id,
      title: sc.title,
      type: sc.type as "DOJO" | "ASSESSMENT",
      description: sc.description,
      status,
      grade: released ? sub?.grade ?? null : null,
    };
  });
}

/** Load a scenario for a student, or null if they aren't authorized for it. */
export async function getStudentScenario(userId: string, scenarioId: string) {
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: { endpoints: { orderBy: { hostname: "asc" } } },
  });
  if (!scenario) return null;

  // PUBLIC scenarios are open to any authenticated student; others require the
  // student's cohort to be bound to the scenario.
  if (scenario.exposure !== "PUBLIC") {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { cohortId: true } });
    if (!user?.cohortId) return null;
    const binding = await prisma.cohortScenario.findUnique({
      where: { cohortId_scenarioId: { cohortId: user.cohortId, scenarioId } },
    });
    if (!binding) return null;
  }

  const [submission, progress] = await Promise.all([
    prisma.submission.findUnique({ where: { scenarioId_studentId: { scenarioId, studentId: userId } } }),
    prisma.scenarioProgress.findUnique({ where: { scenarioId_studentId: { scenarioId, studentId: userId } } }),
  ]);

  return { scenario, submission, progress };
}

/** Whether the student may access/submit a scenario (PUBLIC, or cohort-bound). */
export async function isAuthorizedForScenario(userId: string, scenarioId: string): Promise<boolean> {
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId }, select: { exposure: true } });
  if (!scenario) return false;
  if (scenario.exposure === "PUBLIC") return true;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { cohortId: true } });
  if (!user?.cohortId) return false;
  const binding = await prisma.cohortScenario.findUnique({
    where: { cohortId_scenarioId: { cohortId: user.cohortId, scenarioId } },
  });
  return Boolean(binding);
}

/** Create the progress record on first entry; returns the start time. */
export async function ensureProgress(userId: string, scenarioId: string): Promise<Date> {
  const existing = await prisma.scenarioProgress.findUnique({
    where: { scenarioId_studentId: { scenarioId, studentId: userId } },
  });
  if (existing) return existing.startedAt;
  const created = await prisma.scenarioProgress.create({ data: { scenarioId, studentId: userId } });
  return created.startedAt;
}

export type StudentResult = {
  id: string;
  scenarioTitle: string;
  type: "DOJO" | "ASSESSMENT";
  grade: number | null;
  feedback: string;
  reportFileName: string;
  releasedAt: string;
};

/** A student's released, graded assessment results (with instructor feedback). */
export async function getStudentResults(userId: string): Promise<StudentResult[]> {
  const subs = await prisma.submission.findMany({
    where: { studentId: userId, status: "GRADED", releasedAt: { not: null } },
    orderBy: { releasedAt: "desc" },
    include: { scenario: { select: { title: true, type: true } } },
  });
  return subs.map((s) => ({
    id: s.id,
    scenarioTitle: s.scenario.title,
    type: s.scenario.type as "DOJO" | "ASSESSMENT",
    grade: s.grade,
    feedback: s.feedback || "",
    reportFileName: s.reportFileName || "",
    releasedAt: (s.releasedAt as Date).toISOString(),
  }));
}

/** Strip answers from authored flags before sending to a student. */
export function publicFlags(flags: unknown): { id: string; question: string; points: number }[] {
  if (!Array.isArray(flags)) return [];
  return flags.map((f, i) => ({
    id: String((f as { id?: string })?.id ?? `f${i + 1}`),
    question: String((f as { question?: string })?.question ?? ""),
    points: Number((f as { points?: number })?.points ?? 0),
  }));
}
