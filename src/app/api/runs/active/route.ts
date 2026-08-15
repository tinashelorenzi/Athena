import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { tickAndReadRun } from "@/lib/run-engine";

/**
 * The signed-in student's currently RUNNING scenario (if any) plus the alerts
 * that have fired so far. Drives the app-wide alert toaster, so students get
 * live alert notifications no matter which page they're on.
 */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") return Response.json({ run: null });

  const run = await prisma.scenarioRun.findFirst({
    where: { studentId: user.id, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });
  if (!run) return Response.json({ run: null });

  const scenario = await prisma.scenario.findUnique({
    where: { id: run.scenarioId },
    select: { title: true },
  });
  const { elapsed, alerts } = await tickAndReadRun(run);

  return Response.json({
    run: {
      scenarioId: run.scenarioId,
      title: scenario?.title ?? "Scenario",
      elapsed,
      alerts: (alerts as { id?: string; title?: string; host?: string; seek?: number }[]).map((a, i) => ({
        id: String(a.id ?? `a${i}`),
        title: a.title ?? "Alert",
        host: a.host ?? "",
        seek: a.seek ?? 0,
      })),
    },
  });
}
