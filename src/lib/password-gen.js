/* Client-safe strong-password generator for the "Generate" buttons in the
   instructor UI. Uses the browser's crypto RNG (falls back to Math.random on
   the off chance it's unavailable). The server still validates length. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*?';

export function generatePassword(length = 16) {
  const bytes = new Uint32Array(length);
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 2 ** 32);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
