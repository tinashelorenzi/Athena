import { prisma } from "@/lib/db";
import { authenticateAgent } from "@/lib/labs/agent-auth";
import { agentError } from "@/lib/labs/http";
import { ACTIVE_STATUSES, type LabAsset } from "@/lib/labs/sessions";
import { getObjectStream } from "@/lib/storage";

/**
 * GET /api/agent/assets/{sha256} — a lab asset (pcap, fixture file) for a
 * machine that is in a running session of a lab version that uses it. The
 * agent checks the hash against its signed bundle before using the file.
 */
export async function GET(request: Request, { params }: { params: Promise<{ sha256: string }> }): Promise<Response> {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return auth.response;
  const { sha256 } = await params;
  if (!/^[0-9a-f]{64}$/.test(sha256)) return agentError(400, "bad_request", "Not a sha256.");

  const roles = await prisma.labSessionMachine.findMany({
    where: { machineId: auth.machine.id, session: { status: { in: [...ACTIVE_STATUSES] } } },
    select: { session: { select: { labVersion: { select: { assets: true } } } } },
  });
  const asset = roles.flatMap((r) => r.session.labVersion.assets as unknown as LabAsset[]).find((a) => a.sha256 === sha256);
  if (!asset) return agentError(404, "not_found", "No running session of yours uses that asset.");

  try {
    const { stream, size } = await getObjectStream(asset.storageKey);
    return new Response(stream, {
      headers: { "Content-Type": "application/octet-stream", ...(size ? { "Content-Length": String(size) } : {}), "Cache-Control": "no-store" },
    });
  } catch (e) {
    return agentError(502, "storage_error", `Could not read the asset from storage: ${e instanceof Error ? e.message : e}`);
  }
}
