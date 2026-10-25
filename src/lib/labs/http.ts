/**
 * Response helpers shared by the agent API routes. Every error body follows
 * protocol/schema/error.schema.json: { error, message, retryAfter? }.
 */
export function agentError(status: number, error: string, message: string, retryAfter?: number): Response {
  const headers: Record<string, string> = {};
  if (retryAfter != null) headers["Retry-After"] = String(retryAfter);
  return Response.json(retryAfter != null ? { error, message, retryAfter } : { error, message }, { status, headers });
}

/** Best-effort client IP: first X-Forwarded-For hop, then X-Real-IP. */
export function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || null;
  return request.headers.get("x-real-ip")?.trim() || null;
}
