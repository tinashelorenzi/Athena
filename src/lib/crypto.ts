import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

/**
 * Symmetric encryption for platform secrets stored in the DB (Turnstile secret
 * key, SMTP password, …). AES-256-GCM with a per-value random IV; the auth tag
 * is stored alongside so tampering is detected on decrypt.
 *
 * The key comes from `ATHENA_SETTINGS_KEY` (32 bytes, base64). If it's missing
 * we derive a deterministic dev key and warn — that keeps local dev working but
 * is NOT secure; production must set the env var.
 *
 * Serialized form: `v1:<iv b64>:<tag b64>:<ciphertext b64>`.
 */
let warned = false;

function getKey(): Buffer {
  const raw = process.env.ATHENA_SETTINGS_KEY;
  if (raw && raw !== "generate_me") {
    const key = Buffer.from(raw, "base64");
    if (key.length === 32) return key;
  }
  if (!warned) {
    warned = true;
    console.warn(
      "[crypto] ATHENA_SETTINGS_KEY is unset or invalid — using an insecure derived dev key. Set a 32-byte base64 key in production.",
    );
  }
  // Deterministic 32-byte fallback so dev secrets remain decryptable across restarts.
  return createHash("sha256").update("athena-insecure-dev-key").digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(serialized: string): string {
  const parts = serialized.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Malformed encrypted value.");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
