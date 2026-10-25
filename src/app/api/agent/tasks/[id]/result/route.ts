import { authenticateAgent } from "@/lib/labs/agent-auth";
import { agentError } from "@/lib/labs/http";
import { submitTaskResult } from "@/lib/labs/sessions";

/**
 * POST /api/agent/tasks/{id}/result — the agent's result for a task: a
 * baseline, collected evidence (protocol/schema/evidence.schema.json items),
 * or { ok: false, error, message }.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(auth.body));
  } catch {
    return agentError(400, "bad_request", "Body must be JSON.");
  }
  const { id } = await params;
  const res = await submitTaskResult(auth.machine, id, body);
  if (!res.ok) return agentError(res.status, res.error, res.message);
  return Response.json({ ok: true });
}
