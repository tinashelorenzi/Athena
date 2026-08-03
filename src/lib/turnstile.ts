import { getTurnstileSecret } from "@/lib/settings";

/**
 * Verify a Cloudflare Turnstile token server-side against the siteverify API.
 * Returns false on any failure (no secret configured, network error, or a
 * rejected token) so callers can treat it as "challenge not passed".
 */
export async function verifyTurnstileToken(
  token: string,
  remoteip?: string,
): Promise<boolean> {
  const secret = await getTurnstileSecret();
  if (!secret || !token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteip) body.set("remoteip", remoteip);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}
