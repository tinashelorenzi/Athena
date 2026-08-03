import { verifyApiKey } from "@/lib/apikeys";

/**
 * Example API-key-authenticated endpoint, so generated keys are immediately
 * usable by integrations:
 *   curl -H "Authorization: Bearer ath_..." http://localhost:3000/api/v1/ping
 * Also accepts `X-API-Key: ath_...`.
 */
export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const raw = bearer || request.headers.get("x-api-key") || "";

  const key = await verifyApiKey(raw);
  if (!key) {
    return Response.json(
      { error: "Invalid or missing API key." },
      { status: 401 },
    );
  }

  return Response.json({
    ok: true,
    key: { name: key.name, prefix: key.prefix },
    ts: new Date().toISOString(),
  });
}
