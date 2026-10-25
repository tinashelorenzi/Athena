import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { decodeRawPublicKey, keyFingerprint } from "./signing";

/**
 * Student machines: one-time enrolment codes and enrolment itself
 * (docs/labs/spec.md 7.1). Server-only.
 */

/** Unambiguous alphabet: no 0/O, 1/I/L, U. 31^8 ≈ 8.5e11 codes. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const CODE_TTL_MS = 10 * 60 * 1000;
export const ONLINE_WINDOW_MS = 90 * 1000;

export const AGENT_CAPABILITIES_V1 = ["file", "glob", "run", "service", "package", "log", "baseline", "ssh_lockdown"];

/** Canonical form used for hashing: uppercase, no spaces or dashes. */
export function normalizeCode(code: string): string {
  return String(code ?? "").toUpperCase().replace(/[\s-]/g, "");
}

export function hashCode(code: string): string {
  return createHash("sha256").update(normalizeCode(code)).digest("hex");
}

/** Issue a fresh code for the user; any earlier unused codes are discarded. */
export async function createEnrollCode(userId: string): Promise<{ code: string; expiresAt: Date }> {
  const raw = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await prisma.$transaction([
    prisma.machineEnrollCode.deleteMany({ where: { userId, usedAt: null } }),
    prisma.machineEnrollCode.create({ data: { userId, codeHash: hashCode(code), expiresAt } }),
  ]);
  return { code, expiresAt };
}

/** zaio-<handle>-<NN>: handle from the email local part, NN counts this user's enrolments. */
export function machineHostname(email: string, ordinal: number): string {
  const handle = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "student";
  return `zaio-${handle}-${String(ordinal).padStart(2, "0")}`;
}

export function machineOnline(m: { status: string; lastSeenAt: Date | null }): boolean {
  return m.status === "ACTIVE" && m.lastSeenAt != null && Date.now() - m.lastSeenAt.getTime() < ONLINE_WINDOW_MS;
}

// ── Enrolment ────────────────────────────────────────────────────────────────

export type EnrollInput = {
  email: string;
  code: string;
  label?: string;
  publicKey: string;
  machineId: string;
  productUuid?: string | null;
  os: string;
  osVersion: string;
  osPretty?: string;
  arch: string;
  hostname?: string;
  agentVersion: string;
  capabilities: string[];
};

export type EnrollResult =
  | {
      ok: true;
      machine: { id: string; hostname: string; label: string; keyFingerprint: string };
      owner: { name: string; email: string };
    }
  | { ok: false; status: number; error: string; message: string; retryAfter?: number };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Shape-check the JSON body; returns a message for the first problem. */
export function parseEnrollInput(body: unknown): EnrollInput | string {
  if (typeof body !== "object" || body === null) return "Body must be a JSON object.";
  const b = body as Record<string, unknown>;
  const input: EnrollInput = {
    email: str(b.email, 254).toLowerCase(),
    code: str(b.code, 32),
    label: str(b.label, 40),
    publicKey: str(b.publicKey, 100),
    machineId: str(b.machineId, 64).toLowerCase(),
    productUuid: str(b.productUuid, 64).toLowerCase() || null,
    os: str(b.os, 32).toLowerCase(),
    osVersion: str(b.osVersion, 32),
    osPretty: str(b.osPretty, 120),
    arch: str(b.arch, 16),
    hostname: str(b.hostname, 64),
    agentVersion: str(b.agentVersion, 32),
    capabilities: Array.isArray(b.capabilities) ? b.capabilities.filter((c): c is string => typeof c === "string").map((c) => c.slice(0, 40)).slice(0, 64) : [],
  };
  if (!input.email || !input.code) return "email and code are required.";
  if (!decodeRawPublicKey(input.publicKey)) return "publicKey must be base64 of a raw 32-byte Ed25519 key.";
  if (!/^[0-9a-f]{32}$/.test(input.machineId)) return "machineId must be the 32 hex characters of /etc/machine-id.";
  if (!input.os || !input.osVersion || !input.agentVersion) return "os, osVersion and agentVersion are required.";
  if (!["amd64", "arm64"].includes(input.arch)) return "arch must be amd64 or arm64.";
  return input;
}

const FAILS_PER_IP_PER_HOUR = 20;
const FAILS_PER_USER_PER_HOUR = 5;

export async function enrollMachine(input: EnrollInput, ip: string | null): Promise<EnrollResult> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const user = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  });

  // Rate limits count ENROL_FAILED audit rows.
  const [ipFails, userFails] = await Promise.all([
    ip ? prisma.labAuditEvent.count({ where: { type: "ENROL_FAILED", ip, createdAt: { gte: hourAgo } } }) : 0,
    user ? prisma.labAuditEvent.count({ where: { type: "ENROL_FAILED", userId: user.id, createdAt: { gte: hourAgo } } }) : 0,
  ]);
  if (ipFails >= FAILS_PER_IP_PER_HOUR || userFails >= FAILS_PER_USER_PER_HOUR) {
    return { ok: false, status: 429, error: "rate_limited", message: "Too many failed attempts. Try again in an hour.", retryAfter: 3600 };
  }

  const invalid = async (): Promise<EnrollResult> => {
    await prisma.labAuditEvent.create({ data: { type: "ENROL_FAILED", userId: user?.id ?? null, ip, detail: { email: input.email } } });
    // One answer for wrong, expired, used, or someone else's code.
    return { ok: false, status: 401, error: "invalid_code", message: "That code is invalid or has expired. Generate a new one in Athena → Machines." };
  };
  if (!user) return invalid();

  const codeRow = await prisma.machineEnrollCode.findUnique({ where: { codeHash: hashCode(input.code) } });
  if (!codeRow || codeRow.userId !== user.id || codeRow.usedAt || codeRow.expiresAt < new Date()) return invalid();

  const raw = decodeRawPublicKey(input.publicKey)!;
  const fingerprint = keyFingerprint(raw);

  const result = await prisma.$transaction(async (tx) => {
    // Claim the code atomically so two concurrent enrolments can't both use it.
    const claimed = await tx.machineEnrollCode.updateMany({ where: { id: codeRow.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) return null;

    // Same VM re-enrolled by the same student replaces the old record.
    const replaced = await tx.machine.updateMany({
      where: { userId: user.id, machineId: input.machineId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });

    // The same VM enrolled by someone else is a signal, not a refusal.
    const others = await tx.machine.findMany({
      where: {
        userId: { not: user.id },
        OR: [{ machineId: input.machineId }, ...(input.productUuid ? [{ productUuid: input.productUuid }] : [])],
      },
      select: { id: true, userId: true },
    });

    const ordinal = (await tx.machine.count({ where: { userId: user.id } })) + 1;
    const hostname = machineHostname(user.email, ordinal);
    const machine = await tx.machine.create({
      data: {
        userId: user.id,
        label: input.label || input.hostname || hostname,
        hostname,
        publicKey: input.publicKey,
        keyFingerprint: fingerprint,
        machineId: input.machineId,
        productUuid: input.productUuid,
        os: input.os,
        osVersion: input.osVersion,
        osPretty: input.osPretty ?? "",
        arch: input.arch,
        agentVersion: input.agentVersion,
        capabilities: input.capabilities,
        flags: others.length ? ["MACHINE_SHARED"] : [],
        lastSeenAt: new Date(),
        lastSeenIp: ip,
      },
    });

    await tx.labAuditEvent.create({
      data: {
        type: replaced.count ? "REENROL" : "ENROL",
        userId: user.id,
        machineId: machine.id,
        ip,
        detail: { hostname, fingerprint, os: `${input.os} ${input.osVersion}`, arch: input.arch, agentVersion: input.agentVersion },
      },
    });
    if (others.length) {
      await tx.labAuditEvent.create({
        data: {
          type: "FLAG",
          userId: user.id,
          machineId: machine.id,
          ip,
          detail: { flag: "MACHINE_SHARED", otherMachines: others.map((o) => o.id), otherUsers: [...new Set(others.map((o) => o.userId))] },
        },
      });
    }
    return machine;
  });

  if (!result) return invalid();
  return {
    ok: true,
    machine: { id: result.id, hostname: result.hostname, label: result.label, keyFingerprint: result.keyFingerprint },
    owner: { name: user.name, email: user.email },
  };
}
