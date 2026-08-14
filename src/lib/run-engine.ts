import { prisma } from "@/lib/db";

/**
 * Scenario run engine (server-only). The clock is derived from the run row so it
 * survives reloads and supports pause/resume. The feed (alerts/logs) is NOT
 * stored per student — it's a pure function of elapsed time over the scenario's
 * own data, so `computeFeed` returns whatever has "fired" so far with no writes.
 * DB writes only happen on start/pause/resume/finish (the ScenarioRun clock).
 */
type RunClock = {
  status: "RUNNING" | "PAUSED" | "COMPLETED";
  runningSince: Date | null;
  accumulatedSeconds: number;
};

/** Active seconds elapsed for a run (frozen while paused/completed). */
export function computeElapsed(run: RunClock): number {
  const base = run.accumulatedSeconds;
  if (run.status === "RUNNING" && run.runningSince) {
    return base + Math.max(0, Math.floor((Date.now() - new Date(run.runningSince).getTime()) / 1000));
  }
  return base;
}

type FeedData = { alerts: unknown; logs: unknown };

/** The "fire at" second for each log line, relative to the earliest log. */
function logOffsets(logs: Array<{ ts?: string }>): number[] {
  const times = logs.map((l) => Date.parse(String(l?.ts ?? "")));
  const valid = times.filter((n) => !Number.isNaN(n));
  const min = valid.length ? Math.min(...valid) : 0;
  return times.map((t) => (!Number.isNaN(t) && min ? Math.max(0, Math.floor((t - min) / 1000)) : 0));
}

/**
 * Pure: the alerts/logs that have fired at `elapsed` seconds, each tagged with
 * the second it fired at (`at`). No DB access, no per-student copies.
 */
export function feedAt(feed: FeedData, elapsed: number): { alerts: unknown[]; logs: unknown[] } {
  const rawAlerts = Array.isArray((feed.alerts as { alerts?: unknown[] })?.alerts)
    ? ((feed.alerts as { alerts: Record<string, unknown>[] }).alerts)
    : [];
  const alerts = rawAlerts
    .map((a, i) => ({ a, at: Math.max(0, Math.floor(Number(a.seek ?? 0))), i }))
    .filter((x) => x.at <= elapsed)
    .sort((x, y) => x.at - y.at)
    .map((x) => ({ ...x.a, id: x.a.id ?? `a${x.i}`, at: x.at }));

  const rawLogs = Array.isArray((feed.logs as { entries?: unknown[] })?.entries)
    ? ((feed.logs as { entries: Record<string, unknown>[] }).entries)
    : [];
  const offsets = logOffsets(rawLogs as { ts?: string }[]);
  const logs = rawLogs
    .map((l, i) => ({ l, at: offsets[i], i }))
    .filter((x) => x.at <= elapsed)
    .sort((x, y) => x.at - y.at)
    .map((x) => ({ ...x.l, at: x.at }));

  return { alerts, logs };
}

/** Mark a student's run COMPLETED, banking the elapsed time. Idempotent. */
export async function completeRunFor(studentId: string, scenarioId: string): Promise<void> {
  const run = await prisma.scenarioRun.findUnique({
    where: { scenarioId_studentId: { scenarioId, studentId } },
  });
  if (!run || run.status === "COMPLETED") return;
  const banked = computeElapsed(run);
  await prisma.scenarioRun.update({
    where: { id: run.id },
    data: { status: "COMPLETED", accumulatedSeconds: banked, runningSince: null },
  });
}

/**
 * Compute a run's current elapsed + fired feed for the poll API. Reading, not
 * writing — reloading tomorrow returns everything that had fired at the current
 * (frozen, if paused) elapsed.
 */
export async function tickAndReadRun(run: {
  scenarioId: string;
  status: "RUNNING" | "PAUSED" | "COMPLETED";
  runningSince: Date | null;
  accumulatedSeconds: number;
}): Promise<{ elapsed: number; alerts: unknown[]; logs: unknown[] }> {
  const elapsed = computeElapsed(run);
  const scenario = await prisma.scenario.findUnique({
    where: { id: run.scenarioId },
    select: { alerts: true, logs: true },
  });
  if (!scenario) return { elapsed, alerts: [], logs: [] };
  return { elapsed, ...feedAt(scenario, elapsed) };
}
