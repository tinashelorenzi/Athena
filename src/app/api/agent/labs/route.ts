import { authenticateAgent } from "@/lib/labs/agent-auth";
import { listLabsForUser } from "@/lib/labs/catalog";

/** GET /api/agent/labs — labs the machine's owner can run (`zaio labs`). */
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return auth.response;
  return Response.json({ labs: await listLabsForUser(auth.machine.userId) });
}
