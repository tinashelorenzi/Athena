import { createHash, createPublicKey, verify, type KeyObject } from "node:crypto";

/**
 * Ed25519 helpers for the agent protocol (docs/labs/spec.md 7.2,
 * protocol/README.md). Public keys travel as base64 of the raw 32 bytes.
 * Test vectors: protocol/fixtures/request-signing.json.
 */

export function sha256Hex(body: Uint8Array | string): string {
  return createHash("sha256").update(body).digest("hex");
}

/** The exact string a machine signs for one request. */
export function stringToSign(method: string, pathWithQuery: string, ts: string | number, body: Uint8Array | string): string {
  return `${method.toUpperCase()}\n${pathWithQuery}\n${ts}\n${sha256Hex(body)}`;
}

/** Decode a base64 raw Ed25519 public key; null if it isn't exactly 32 bytes. */
export function decodeRawPublicKey(b64: string): Buffer | null {
  if (typeof b64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  const raw = Buffer.from(b64, "base64");
  return raw.length === 32 ? raw : null;
}

export function publicKeyObject(raw: Buffer): KeyObject {
  return createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: raw.toString("base64url") }, format: "jwk" });
}

/** `SHA256:` + unpadded base64 of sha256(raw key), as OpenSSH prints it. */
export function keyFingerprint(raw: Buffer): string {
  return "SHA256:" + createHash("sha256").update(raw).digest("base64").replace(/=+$/, "");
}

export function verifySignature(publicKeyB64: string, message: string, signatureB64: string): boolean {
  const raw = decodeRawPublicKey(publicKeyB64);
  if (!raw) return false;
  const sig = Buffer.from(signatureB64 || "", "base64");
  if (sig.length !== 64) return false;
  try {
    return verify(null, Buffer.from(message, "utf8"), publicKeyObject(raw), sig);
  } catch {
    return false;
  }
}
