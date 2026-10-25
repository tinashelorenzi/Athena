import { authenticateAgent } from "@/lib/labs/agent-auth";
import { labErrorResponse, sessionResponse } from "@/lib/labs/agent-sessions";
import { agentError } from "@/lib/labs/http";
import { loadLabForUser, startSession } from "@/lib/labs/sessions";

/**
 * POST /api/agent/sessions { lab: "<slug>", role?: "<role>" } — `zaio start`.
 * This machine fills the lab's role (single-role labs, or `role` given).
 * Labs with several machines are started from the lab page in Athena.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return auth.response;
  let body: { lab?: unknown; role?: unknown };
  try {
    body = JSON.parse(new TextDecoder().decode(auth.body) || "{}");
  } catch {
    return agentError(400, "bad_request", "Body must be JSON.");
  }
  if (typeof body.lab !== "string" || !body.lab) return agentError(400, "bad_request", "Which lab? e.g. zaio start p21-web");

  try {
    const { definition } = await loadLabForUser(auth.machine.userId, { slug: body.lab });
    const roles = Object.keys(definition.machines);
    const role = typeof body.role === "string" ? body.role : roles.length === 1 ? roles[0] : null;
    if (!role || !roles.includes(role)) {
      return agentError(409, "multi_machine", `This lab uses ${roles.length} machines (${roles.join(", ")}). Start it from the lab page in Athena and choose a machine for each.`);
    }
    const session = await startSession({ userId: auth.machine.userId, slug: body.lab, assignments: { [role]: auth.machine.id } });
    return sessionResponse(session.id, auth.machine, 201);
  } catch (e) {
    return labErrorResponse(e);
  }
}
