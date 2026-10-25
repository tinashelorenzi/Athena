import { prisma } from "@/lib/db";
import { authenticateAgent } from "@/lib/labs/agent-auth";
import { getSigningKey } from "@/lib/labs/bundle-signing";

/** GET /api/agent/me — the signed-in machine and its owner (protocol/schema/me-response.schema.json). */
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return auth.response;
  const { machine } = auth;
  const owner = await prisma.user.findUnique({
    where: { id: machine.userId },
    select: { name: true, email: true, cohort: { select: { name: true } } },
  });
  return Response.json({
    machine: {
      id: machine.id,
      label: machine.label,
      hostname: machine.hostname,
      status: machine.status,
      enrolledAt: machine.enrolledAt.toISOString(),
      keyFingerprint: machine.keyFingerprint,
    },
    owner: { name: owner?.name ?? "", email: owner?.email ?? "", cohort: owner?.cohort?.name ?? null },
    labs: [],
    // Bundles are signed with this key; agents enrolled before bundle signing pin it from here.
    athena: { keyId: (await getSigningKey()).keyId, publicKey: (await getSigningKey()).publicKey },
    serverTime: new Date().toISOString(),
  });
}
