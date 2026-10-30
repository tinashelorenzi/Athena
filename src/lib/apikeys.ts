import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * API key helpers (server-only). Keys look like `ath_<43 base64url chars>`.
 * Only the SHA-256 hash is stored; the raw key is shown once at creation.
 * `prefix` (the first 12 chars) is non-secret and used to identify keys in the
 * management UI.
 */
const PREFIX = "ath_";
/** MCP keys (docs/mcp.md): personal to an architect, only valid on /api/mcp. */
const MCP_PREFIX = "athmcp_";

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newApiKeyMaterial(kind: "INTEGRATION" | "MCP" = "INTEGRATION"): { raw: string; prefix: string; keyHash: string } {
  const lead = kind === "MCP" ? MCP_PREFIX : PREFIX;
  const raw = lead + randomBytes(32).toString("base64url");
  return { raw, prefix: raw.slice(0, lead.length + 8), keyHash: hashApiKey(raw) };
}

/**
 * Validate a raw key from an incoming request. Returns the key record (and
 * bumps `lastUsedAt`) or null if missing/unknown/revoked.
 */
export async function verifyApiKey(raw: string | null | undefined) {
  if (!raw || !raw.startsWith(PREFIX)) return null;

  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(raw) } });
  if (!key || key.revokedAt || key.kind !== "INTEGRATION") return null;

  await prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return key;
}

/**
 * Validate an MCP key and return the architect it acts as, or null. The owner
 * must *still* be an instructor with the architect attribute: losing either
 * disables their keys without revoking them.
 */
export async function verifyMcpKey(raw: string | null | undefined) {
  if (!raw || !raw.startsWith(MCP_PREFIX)) return null;

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(raw) },
    include: { user: { select: { id: true, email: true, name: true, role: true, isArchitect: true } } },
  });
  if (!key || key.revokedAt || key.kind !== "MCP" || !key.user) return null;
  if (key.user.role !== "SUPER_ADMIN" || !key.user.isArchitect) return null;

  await prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return { keyId: key.id, keyName: key.name, user: key.user };
}
