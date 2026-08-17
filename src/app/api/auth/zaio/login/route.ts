import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { buildZaioAuthorizeUrl, isZaioSsoEnabled } from "@/lib/zaio-sso";
import { secureCookieEnabled } from "@/lib/auth";

const STATE_COOKIE = "athena_zaio_sso_state";
const RETURN_TO_COOKIE = "athena_zaio_sso_return_to";
const STATE_TTL_SECONDS = 600;

function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

function sanitizeReturnTo(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
}

export async function GET(request: Request) {
  if (!isZaioSsoEnabled()) {
    return NextResponse.json({ error: "Zaio SSO is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));

  const state = randomBytes(24).toString("base64url");
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    // Match the session cookie so SSO works over plain-HTTP staging
    // (SESSION_COOKIE_SECURE=false) instead of the browser dropping the cookie.
    secure: secureCookieEnabled(),
    maxAge: STATE_TTL_SECONDS,
    path: "/api/auth/zaio/callback",
  };

  cookieStore.set(STATE_COOKIE, hashState(state), cookieOptions);
  if (returnTo) {
    cookieStore.set(RETURN_TO_COOKIE, returnTo, cookieOptions);
  }

  return NextResponse.redirect(buildZaioAuthorizeUrl(state));
}
