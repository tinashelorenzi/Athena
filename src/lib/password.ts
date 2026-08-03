import { hash, verify } from "@node-rs/argon2";
import { randomInt } from "node:crypto";

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

// Character classes for generated passwords. `O/0` and `I/l/1` are omitted to
// keep credentials easy to read aloud and transcribe without ambiguity.
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

/**
 * Generate a cryptographically-random password. Used to issue credentials for
 * provisioned accounts (instructors via CLI, students via the portal) since
 * users never choose their own password at creation time.
 *
 * Guarantees at least one character from each class, then fills the rest from
 * the full alphabet and shuffles — all draws use `crypto.randomInt` for an
 * unbiased distribution.
 */
export function generatePassword(length = 20): string {
  if (length < 8) throw new Error("Password length must be at least 8.");

  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));

  // Fisher–Yates shuffle so the guaranteed characters aren't always in front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
