import { verifyApiKey } from "@/lib/apikeys";

/** Extract a raw `ath_...` key from Authorization Bearer or X-API-Key. */
export function readApiKeyFromRequest(request: Request): string {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return bearer || (request.headers.get("x-api-key") ?? "").trim();
}

/** Validate an integration API key; returns the key row or null. */
export async function requireApiKey(request: Request) {
  return verifyApiKey(readApiKeyFromRequest(request));
}
