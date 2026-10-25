import { enrollMachine, parseEnrollInput } from "@/lib/labs/machines";
import { agentError, clientIp } from "@/lib/labs/http";
import { getSigningKey } from "@/lib/labs/bundle-signing";

/**
 * POST /api/agent/enroll — enrol a machine with a one-time code from Athena →
 * Machines. Unsigned: the code is the credential. Schemas:
 * protocol/schema/enroll-request.schema.json, enroll-response.schema.json.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return agentError(400, "bad_request", "Body must be JSON.");
  }
  const input = parseEnrollInput(body);
  if (typeof input === "string") return agentError(400, "bad_request", input);

  const result = await enrollMachine(input, clientIp(request));
  if (!result.ok) return agentError(result.status, result.error, result.message, result.retryAfter);

  const key = await getSigningKey();
  return Response.json(
    {
      machineId: result.machine.id,
      hostname: result.machine.hostname,
      label: result.machine.label,
      keyFingerprint: result.machine.keyFingerprint,
      owner: result.owner,
      // The agent pins this key (fetched over TLS) and verifies every bundle with it.
      athenaKeyId: key.keyId,
      athenaPublicKey: key.publicKey,
    },
    { status: 201 },
  );
}
