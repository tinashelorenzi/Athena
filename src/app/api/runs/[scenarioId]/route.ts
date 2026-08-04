import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAuthorizedForScenario } from "@/lib/student";
import { tickAndReadRun } from "@/lib/run-engine";

/**
 * Live feed poll for a student's run. Runs a catch-up materialization (so the
 * feed is fresh even if the workers are momentarily behind) and returns the
 * current run status, elapsed seconds, and the alerts/logs that have fired.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ scenarioId: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { scenarioId } = await params;
  if (!(await isAuthorizedForScenario(user.id, scenarioId))) {
    return new Response("Forbidden", { status: 403 });
  }

  const run = await prisma.scenarioRun.findUnique({
    where: { scenarioId_studentId: { scenarioId, studentId: user.id } },
  });
  if (!run) return Response.json({ status: "NONE", elapsed: 0, alerts: [], logs: [] });

  const { elapsed, alerts, logs } = await tickAndReadRun(run);
  return Response.json({
    status: run.status,
    elapsed,
    startedAt: run.startedAt.toISOString(),
    alerts,
    logs,
  });
}
