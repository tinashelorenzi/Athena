import { headers } from "next/headers";

/**
 * Absolute base URL for links embedded in server-sent emails (invitations, etc.).
 *
 * Prefers the explicit `APP_BASE_URL` env — set it in staging/production where
 * the app sits behind a reverse proxy and the forwarded host/scheme may be
 * unreliable (e.g. plain-HTTP nginx that doesn't send `X-Forwarded-Proto`).
 * When unset, it's derived from the incoming request headers.
 *
 * Client-side links (e.g. the scenario reference link) don't use this — they use
 * `window.location.origin`, which is always correct in the browser.
 */
export async function getBaseUrl(): Promise<string> {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0].trim() ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
