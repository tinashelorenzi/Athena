/**
 * soc-master — scenario data-feed worker.
 *
 * Two instances run under PM2 (soc-master1 / soc-master2). They continuously
 * materialize the alert/log feed for every RUNNING scenario, sharding the runs
 * between them by run id so the two workers split the load. State is stored in
 * RunEvent rows (the same catch-up logic the poll API uses).
 *
 * Env: SOC_WORKER_INDEX (0-based), SOC_WORKER_COUNT, SOC_TICK_MS.
 * Run via `pm2 start ecosystem.config.js` (see docs/workers.md).
 */
import { createHash } from "node:crypto";

const INDEX = Number(process.env.SOC_WORKER_INDEX ?? 0);
const COUNT = Math.max(1, Number(process.env.SOC_WORKER_COUNT ?? 1));
const TICK_MS = Number(process.env.SOC_TICK_MS ?? 3000);
const NAME = `soc-master${INDEX + 1}`;

/** Deterministic sharding: each run is owned by exactly one worker. */
function owns(runId: string): boolean {
  const h = parseInt(createHash("md5").update(runId).digest("hex").slice(0, 8), 16);
  return h % COUNT === INDEX;
}

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    // env already populated
  }

  const { prisma } = await import("@/lib/db");
  const { computeElapsed, materializeRun } = await import("@/lib/run-engine");

  console.log(`[${NAME}] started — shard ${INDEX + 1}/${COUNT}, tick ${TICK_MS}ms`);

  let running = true;
  const stop = () => { running = false; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (running) {
    try {
      const runs = await prisma.scenarioRun.findMany({ where: { status: "RUNNING" } });
      for (const run of runs) {
        if (!owns(run.id)) continue;
        const scenario = await prisma.scenario.findUnique({
          where: { id: run.scenarioId },
          select: { alerts: true, logs: true },
        });
        if (!scenario) continue;
        const fired = await materializeRun(run, scenario, computeElapsed(run));
        if (fired > 0) console.log(`[${NAME}] run ${run.id}: +${fired} event(s) @ T+${computeElapsed(run)}s`);
      }
    } catch (e) {
      console.error(`[${NAME}] tick error:`, e instanceof Error ? e.message : e);
    }
    await new Promise((res) => setTimeout(res, TICK_MS));
  }

  await prisma.$disconnect();
  console.log(`[${NAME}] stopped`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
