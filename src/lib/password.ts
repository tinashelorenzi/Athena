import { hash, verify } from "@node-rs/argon2";

// @node-rs/argon2 exports `Algorithm` as an ambient `const enum`, which cannot
// be referenced under TypeScript's `isolatedModules` (used by Next.js). We use
// the underlying numeric value instead: Argon2d = 0, Argon2i = 1, Argon2id = 2.
const ARGON2ID = 2;

/**
 * Argon2id password hashing for Athena.
 *
 * Argon2id is the OWASP-recommended default: it combines Argon2i's resistance
 * to side-channel attacks with Argon2d's resistance to GPU cracking. The
 * parameters below follow OWASP's minimum guidance (19 MiB memory, 2 iterations,
 * 1 degree of parallelism) and can be tuned upward as hardware allows.
 *
 * These functions are server-only. The `@node-rs/argon2` package uses native
 * bindings and must never be imported into a Client Component. Call them from
 * Route Handlers, Server Actions, or other server-side code.
 */

const HASH_OPTIONS = {
  algorithm: ARGON2ID,
  // 19 MiB, expressed in KiB.
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Hash a plaintext password. The returned PHC-format string embeds the
 * algorithm, parameters, and salt, so it is the only value you need to store.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, HASH_OPTIONS);
}

/**
 * Verify a plaintext password against a previously stored hash.
 * Returns `false` (rather than throwing) if the stored hash is malformed.
 */
export async function verifyPassword(
  storedHash: string,
  plaintext: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext);
  } catch {
    return false;
  }
}
