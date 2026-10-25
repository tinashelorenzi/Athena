import { prisma } from "@/lib/db";
import type { Machine } from "@/generated/prisma/client";
import { agentError } from "./http";
import { LabError, takeTasks } from "./sessions";
import { buildSessionView } from "./views";

/**
 * Shared bits of the CLI-facing session routes (zaio start/check/end): the
 * calling machine must be in the session, LabErrors become API errors, and
 * responses carry the session view plus this machine's freshly queued tasks
 * so the CLI can run them at once.
 */

export async function sessionForMachine(sessionId: string, machine: Machine) {
  const s = await prisma.labSession.findUnique({ where: { id: sessionId }, include: { machines: true } });
  if (!s || s.userId !== machine.userId || !s.machines.some((m) => m.machineId === machine.id)) return null;
  return s;
}

export async function sessionResponse(sessionId: string, machine: Machine, status = 200): Promise<Response> {
  const tasks = await takeTasks(machine.id, { sessionId });
  return Response.json({ session: await buildSessionView(sessionId), tasks }, { status });
}

export function labErrorResponse(e: unknown): Response {
  if (e instanceof LabError) return agentError(e.status, e.code, e.message);
  throw e;
}
