import { authenticateAgent } from "@/lib/labs/agent-auth";
import { settleMachineSessions, takeTasks } from "@/lib/labs/sessions";
import { waitForMachine } from "@/lib/labs/task-events";

/**
 * GET /api/agent/tasks?wait=N — the daemon's long poll, which is also its
 * heartbeat. Returns queued tasks at once, or waits up to N (≤ 25) seconds
 * for one: woken immediately when a task is queued in this process, and
 * re-checking every 5 s otherwise. Schema: protocol/schema/tasks-response.schema.json.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return auth.response;
  const { machine } = auth;
  const wait = Math.min(Math.max(Number(new URL(request.url).searchParams.get("wait")) || 0, 0), 25);

  await settleMachineSessions(machine.id);
  let tasks = await takeTasks(machine.id);
  const deadline = Date.now() + wait * 1000;
  while (!tasks.length && Date.now() < deadline && !request.signal.aborted) {
    await waitForMachine(machine.id, Math.min(5000, deadline - Date.now()), request.signal);
    tasks = await takeTasks(machine.id);
  }
  return Response.json({ tasks, pollAfter: tasks.length ? 1 : 2, serverTime: new Date().toISOString() });
}
