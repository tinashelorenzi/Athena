import { createPrivateKey, createPublicKey, randomBytes, sign, type KeyObject } from "node:crypto";
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/**
 * Athena's Ed25519 key for signing task bundles (docs/labs/spec.md 7.3).
 * Agents pin the public half at enrolment (over TLS) and refuse any bundle it
 * didn't sign.
 *
 * The key is generated on first use and stored encrypted in the settings table
 * (like other platform secrets), so nothing has to be configured. Set
 * ATHENA_AGENT_SIGNING_KEY (base64 32-byte seed) + ATHENA_AGENT_KEY_ID to
 * supply one instead, e.g. to keep it out of the database.
 */

const SEED_KEY = "labs.agentSigning.seed";
const ID_KEY = "labs.agentSigning.keyId";

export type SigningKey = { keyId: string; privateKey: KeyObject; publicKey: string };

let cached: SigningKey | null = null;

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export function keyFromSeed(seed: Buffer, keyId: string): SigningKey {
  if (seed.length !== 32) throw new Error("Ed25519 seed must be 32 bytes");
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: "der", type: "pkcs8" });
  const x = createPublicKey(privateKey).export({ format: "jwk" }).x!;
  return { keyId, privateKey, publicKey: Buffer.from(x, "base64url").toString("base64") };
}

export async function getSigningKey(): Promise<SigningKey> {
  if (cached) return cached;
  const fromEnv = process.env.ATHENA_AGENT_SIGNING_KEY?.trim();
  if (fromEnv) {
    cached = keyFromSeed(Buffer.from(fromEnv, "base64"), process.env.ATHENA_AGENT_KEY_ID?.trim() || "athena-env-1");
    return cached;
  }
  const rows = await prisma.setting.findMany({ where: { key: { in: [SEED_KEY, ID_KEY] } } });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (byKey[SEED_KEY] && byKey[ID_KEY]) {
    cached = keyFromSeed(Buffer.from(decryptSecret(byKey[SEED_KEY]), "base64"), byKey[ID_KEY]);
    return cached;
  }
  // First use: generate. If two requests race, the unique key makes one lose; re-read.
  const seed = randomBytes(32);
  const keyId = `athena-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString("hex")}`;
  try {
    await prisma.$transaction([
      prisma.setting.create({ data: { key: SEED_KEY, value: encryptSecret(seed.toString("base64")) } }),
      prisma.setting.create({ data: { key: ID_KEY, value: keyId } }),
    ]);
  } catch {
    cached = null;
    return getSigningKey();
  }
  cached = keyFromSeed(seed, keyId);
  return cached;
}

/** Sign the exact bytes of a bundle; agents verify these bytes before parsing. */
export async function signBundle(bundle: object): Promise<{ bytes: Buffer; signature: string; keyId: string }> {
  const key = await getSigningKey();
  const bytes = Buffer.from(JSON.stringify(bundle), "utf8");
  return { bytes, signature: sign(null, bytes, key.privateKey).toString("base64"), keyId: key.keyId };
}
