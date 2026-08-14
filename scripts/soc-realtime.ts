/**
 * soc-realtime — live scenario feed over WebSockets.
 *
 * Clients connect (authenticated by the `athena_session` cookie), subscribe to a
 * scenario, and receive the fired alerts/logs pushed every tick — computed from
 * the run clock (no per-student storage). Pause/resume/finish happen via the
 * normal HTTP actions (which update ScenarioRun); this picks them up on the next
 * tick. Run under PM2 (`ecosystem.config.js`) behind nginx (proxy `/ws`).
 *
 * Env: SOC_REALTIME_PORT (default 3002), SOC_REALTIME_TICK_MS (default 1000).
 */
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.SOC_REALTIME_PORT ?? 3002);
const TICK_MS = Number(process.env.SOC_REALTIME_TICK_MS ?? 1000);

function cookieValue(header: string, name: string): string | null {
  for (const part of header.split(/; */)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    // env already populated
  }
  const { prisma } = await import("@/lib/db");
  const { computeElapsed, feedAt } = await import("@/lib/run-engine");

  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("soc-realtime ok");
  });
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    const token = cookieValue(req.headers.cookie ?? "", "athena_session");
    const session = token
      ? await prisma.session.findUnique({
          where: { tokenHash: hashToken(token) },
          include: { user: { select: { id: true, cohortId: true, role: true } } },
        })
      : null;
    if (!session || session.expiresAt.getTime() < Date.now()) {
      ws.close(4001, "unauthenticated");
      return;
    }
    const user = session.user;

    let timer: ReturnType<typeof setInterval> | null = null;
    const clear = () => { if (timer) clearInterval(timer); timer = null; };

    ws.on("message", async (raw) => {
      let msg: { type?: string; scenarioId?: string };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.type !== "subscribe" || typeof msg.scenarioId !== "string") return;

      const scenarioId = msg.scenarioId;
      // Authorize: the student's cohort must have this scenario bound.
      if (user.role !== "STUDENT" || !user.cohortId) {
        ws.send(JSON.stringify({ type: "error", error: "forbidden" }));
        return;
      }
      const binding = await prisma.cohortScenario.findUnique({
        where: { cohortId_scenarioId: { cohortId: user.cohortId, scenarioId } },
      });
      if (!binding) {
        ws.send(JSON.stringify({ type: "error", error: "forbidden" }));
        return;
      }
      const scenarioData = await prisma.scenario.findUnique({
        where: { id: scenarioId },
        select: { alerts: true, logs: true },
      });

      clear();
      const push = async () => {
        try {
          const run = await prisma.scenarioRun.findUnique({
            where: { scenarioId_studentId: { scenarioId, studentId: user.id } },
          });
          if (!run) {
            ws.send(JSON.stringify({ type: "feed", status: "NONE", elapsed: 0, alerts: [], logs: [] }));
            return;
          }
          const elapsed = computeElapsed(run);
          const { alerts, logs } = feedAt(scenarioData ?? { alerts: null, logs: null }, elapsed);
          ws.send(JSON.stringify({ type: "feed", status: run.status, elapsed, alerts, logs }));
        } catch {
          /* transient DB error — try again next tick */
        }
      };
      await push();
      timer = setInterval(push, TICK_MS);
    });

    ws.on("close", clear);
    ws.on("error", clear);
    ws.send(JSON.stringify({ type: "ready" }));
  });

  server.listen(PORT, () => console.log(`[soc-realtime] listening on :${PORT} (path /ws), tick ${TICK_MS}ms`));

  const shutdown = () => {
    wss.close();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
