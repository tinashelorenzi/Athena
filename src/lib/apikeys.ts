import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * API key helpers (server-only). Keys look like `ath_<43 base64url chars>`.
 * Only the SHA-256 hash is stored; the raw key is shown once at creation.
 * `prefix` (the first 12 chars) is non-secret and used to identify keys in the
 * management UI.
 */
const PREFIX = "ath_";

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newApiKeyMaterial(): { raw: string; prefix: string; keyHash: string } {
  const raw = PREFIX + randomBytes(32).toString("base64url");
  return { raw, prefix: raw.slice(0, 12), keyHash: hashApiKey(raw) };
}

/**
 * Validate a raw key from an incoming request. Returns the key record (and
 * bumps `lastUsedAt`) or null if missing/unknown/revoked.
 */
export async function verifyApiKey(raw: string | null | undefined) {
  if (!raw || !raw.startsWith(PREFIX)) return null;

  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(raw) } });
  if (!key || key.revokedAt) return null;

  await prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return key;
}
