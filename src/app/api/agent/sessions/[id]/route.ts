import { authenticateAgent } from "@/lib/labs/agent-auth";
import { sessionForMachine, sessionResponse } from "@/lib/labs/agent-sessions";
import { agentError } from "@/lib/labs/http";
import { settle } from "@/lib/labs/sessions";

/** GET /api/agent/sessions/{id} — session state and visible results (the CLI waits on this). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!(await sessionForMachine(id, auth.machine))) return agentError(404, "not_found", "No such session on this machine.");
  await settle(id);
  return sessionResponse(id, auth.machine);
}
