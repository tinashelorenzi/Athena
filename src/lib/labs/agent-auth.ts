import { prisma } from "@/lib/db";
import { stringToSign, verifySignature } from "./signing";
import { agentError, clientIp } from "./http";
import type { Machine } from "@/generated/prisma/client";

/**
 * Verifies a signed agent request (docs/labs/spec.md 7.2):
 *   X-Zaio-Machine, X-Zaio-Ts (Unix seconds), X-Zaio-Sig (Ed25519 over
 *   METHOD \n path?query \n ts \n sha256hex(body)).
 * Checks: machine exists and is ACTIVE, |ts - now| ≤ 300 s, signature valid,
 * and (machine, ts, sig) not seen before (Postgres replay cache, 10 minutes).
 * On success touches lastSeenAt/lastSeenIp/agentVersion and returns the raw
 * body bytes so the route can parse them.
 */
const MAX_SKEW_SECONDS = 300;
const REPLAY_WINDOW_MS = 10 * 60 * 1000;
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export type AgentAuth = { ok: true; machine: Machine; body: Uint8Array } | { ok: false; response: Response };

export async function authenticateAgent(request: Request): Promise<AgentAuth> {
  const machineId = request.headers.get("x-zaio-machine") ?? "";
  const ts = request.headers.get("x-zaio-ts") ?? "";
  const sig = request.headers.get("x-zaio-sig") ?? "";
  const fail = (status: number, code: string, message: string) => ({ ok: false as const, response: agentError(status, code, message) });

  if (!machineId || !/^\d{1,12}$/.test(ts) || !sig) {
    return fail(401, "unsigned", "Missing or malformed X-Zaio-Machine / X-Zaio-Ts / X-Zaio-Sig headers.");
  }
  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (skew > MAX_SKEW_SECONDS) {
    return fail(401, "clock_skew", `Request timestamp is ${skew}s away from Athena's clock. Check the machine's time (timedatectl).`);
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return fail(413, "too_large", "Request body is too large.");
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > MAX_BODY_BYTES) return fail(413, "too_large", "Request body is too large.");

  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine) return fail(401, "unknown_machine", "This machine is not enrolled. Run `sudo zaio setup`.");
  if (machine.status !== "ACTIVE") {
    return fail(401, "machine_revoked", "This machine was removed from Athena. Run `sudo zaio setup` to enrol it again.");
  }

  const url = new URL(request.url);
  const message = stringToSign(request.method, url.pathname + url.search, ts, body);
  if (!verifySignature(machine.publicKey, message, sig)) {
    await audit("REQUEST_REJECTED", machine, request, { reason: "bad_signature", path: url.pathname });
    return fail(401, "bad_signature", "Request signature is invalid.");
  }

  // Replay cache: the primary key makes a second insert of the same triple fail.
  try {
    await prisma.agentRequestNonce.create({ data: { key: `${machine.id}:${ts}:${sig}` } });
  } catch {
    await audit("REQUEST_REJECTED", machine, request, { reason: "replay", path: url.pathname });
    return fail(401, "replayed", "This signed request was already used.");
  }
  if (Math.random() < 0.05) {
    await prisma.agentRequestNonce.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - REPLAY_WINDOW_MS) } } });
  }

  // The agent reports its version and capabilities on every request, so an
  // upgraded agent is recognised without re-enrolling.
  const agentVersion = request.headers.get("x-zaio-agent")?.slice(0, 32);
  const capsHeader = request.headers.get("x-zaio-capabilities");
  const capabilities = capsHeader === null ? null : capsHeader.split(",").map((c) => c.trim()).filter(Boolean).slice(0, 64);
  const capsChanged = capabilities !== null && capabilities.join(",") !== machine.capabilities.join(",");
  const updated = await prisma.machine.update({
    where: { id: machine.id },
    data: {
      lastSeenAt: new Date(),
      lastSeenIp: clientIp(request),
      ...(agentVersion && agentVersion !== machine.agentVersion ? { agentVersion } : {}),
      ...(capsChanged ? { capabilities } : {}),
    },
  });
  return { ok: true, machine: updated, body };
}

async function audit(type: string, machine: Machine, request: Request, detail: Record<string, unknown>) {
  await prisma.labAuditEvent.create({
    data: { type, userId: machine.userId, machineId: machine.id, ip: clientIp(request), detail: detail as object },
  });
}
