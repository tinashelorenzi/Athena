import { authenticateAgent } from "@/lib/labs/agent-auth";
import { labErrorResponse, sessionForMachine, sessionResponse } from "@/lib/labs/agent-sessions";
import { agentError } from "@/lib/labs/http";
import { requestCheck } from "@/lib/labs/sessions";

/** POST /api/agent/sessions/{id}/check — `zaio check`: a practice check run. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const s = await sessionForMachine(id, auth.machine);
  if (!s) return agentError(404, "not_found", "No such session on this machine.");
  try {
    await requestCheck(id, s.userId, false);
    return sessionResponse(id, auth.machine, 201);
  } catch (e) {
    return labErrorResponse(e);
  }
}
