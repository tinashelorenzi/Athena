import { prisma } from "@/lib/db";

/**
 * Scenario run engine (server-only). The clock is derived from the run row so
 * it survives reloads and supports pause/resume; the feed (alerts/logs) is
 * materialized into RunEvent rows by the soc-master workers and by a load-time
 * catch-up, so the two share this logic.
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

/** Compute the "fire at" second for each log line, relative to the earliest log. */
function logOffsets(logs: Array<{ ts?: string }>): number[] {
  const times = logs.map((l) => Date.parse(String(l?.ts ?? "")));
  const valid = times.filter((n) => !Number.isNaN(n));
  const min = valid.length ? Math.min(...valid) : 0;
  return times.map((t) => (!Number.isNaN(t) && min ? Math.max(0, Math.floor((t - min) / 1000)) : 0));
}

/**
 * Materialize any alert/log events that have fired in (feedCursor, elapsed].
 * Idempotent (unique on runId+kind+refId). Returns the number newly fired.
 */
export async function materializeRun(
  run: { id: string; feedCursor: number },
  feed: FeedData,
  elapsed: number,
): Promise<number> {
  // feedCursor = next unmaterialized second. Fire events in [feedCursor, elapsed]
  // (inclusive), so seek-0 events fire at start.
  if (elapsed < run.feedCursor) {
    await prisma.scenarioRun.update({ where: { id: run.id }, data: { lastTickAt: new Date() } });
    return 0;
  }

  const events: { kind: "ALERT" | "LOG"; refId: string; atSeconds: number; payload: unknown }[] = [];

  const alerts = Array.isArray((feed.alerts as { alerts?: unknown[] })?.alerts)
    ? ((feed.alerts as { alerts: Record<string, unknown>[] }).alerts)
    : [];
  alerts.forEach((a, i) => {
    const at = Math.max(0, Math.floor(Number(a.seek ?? 0)));
    if (at >= run.feedCursor && at <= elapsed) {
      events.push({ kind: "ALERT", refId: String(a.id ?? `a${i}`), atSeconds: at, payload: a });
    }
  });

  const logs = Array.isArray((feed.logs as { entries?: unknown[] })?.entries)
    ? ((feed.logs as { entries: Record<string, unknown>[] }).entries)
    : [];
  const offsets = logOffsets(logs as { ts?: string }[]);
  logs.forEach((l, i) => {
    const off = offsets[i];
    if (off >= run.feedCursor && off <= elapsed) {
      events.push({ kind: "LOG", refId: `l${i}`, atSeconds: off, payload: l });
    }
  });

  if (events.length) {
    await prisma.runEvent.createMany({
      data: events.map((e) => ({ runId: run.id, ...e, payload: e.payload as object })),
      skipDuplicates: true,
    });
  }
  await prisma.scenarioRun.update({
    where: { id: run.id },
    data: { feedCursor: elapsed + 1, lastTickAt: new Date() },
  });
  return events.length;
}

/** Materialize one run then read its fired feed — used by the poll API. */
export async function tickAndReadRun(run: {
  id: string;
  scenarioId: string;
  feedCursor: number;
  status: "RUNNING" | "PAUSED" | "COMPLETED";
  runningSince: Date | null;
  accumulatedSeconds: number;
}): Promise<{ elapsed: number; alerts: unknown[]; logs: unknown[] }> {
  const elapsed = computeElapsed(run);
  const scenario = await prisma.scenario.findUnique({
    where: { id: run.scenarioId },
    select: { alerts: true, logs: true },
  });
  if (scenario) await materializeRun(run, scenario, elapsed);

  const events = await prisma.runEvent.findMany({
    where: { runId: run.id },
    orderBy: [{ atSeconds: "asc" }, { firedAt: "asc" }],
  });
  return {
    elapsed,
    alerts: events.filter((e) => e.kind === "ALERT").map((e) => ({ ...(e.payload as object), firedAt: e.firedAt })),
    logs: events.filter((e) => e.kind === "LOG").map((e) => ({ ...(e.payload as object), firedAt: e.firedAt })),
  };
}
