import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/password";

export type ZaioSsoUser = {
  id: string;
  email: string;
  name: string;
  studentNumber: string | null;
  isAdmin: boolean;
  accBlocked: boolean;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function isZaioSsoEnabled(): boolean {
  return Boolean(
    process.env.ZAIO_SSO_CLIENT_SECRET?.trim() &&
      process.env.ZAIO_SSO_AUTHORIZE_URL?.trim() &&
      process.env.ZAIO_SSO_TOKEN_URL?.trim() &&
      process.env.ZAIO_SSO_REDIRECT_URI?.trim(),
  );
}

export function getZaioSsoPublicConfig() {
  if (!isZaioSsoEnabled()) return { enabled: false as const };
  return {
    enabled: true as const,
    loginUrl: "/api/auth/zaio/login",
  };
}

export function buildZaioAuthorizeUrl(state: string): string {
  const authorizeUrl = new URL(requiredEnv("ZAIO_SSO_AUTHORIZE_URL"));
  authorizeUrl.searchParams.set("client_id", process.env.ZAIO_SSO_CLIENT_ID || "athena");
  authorizeUrl.searchParams.set("redirect_uri", requiredEnv("ZAIO_SSO_REDIRECT_URI"));
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);
  return authorizeUrl.toString();
}

export async function exchangeZaioAuthorizationCode(code: string): Promise<ZaioSsoUser> {
  const tokenUrl = requiredEnv("ZAIO_SSO_TOKEN_URL");
  const redirectUri = requiredEnv("ZAIO_SSO_REDIRECT_URI");
  const clientId = process.env.ZAIO_SSO_CLIENT_ID || "athena";
  const clientSecret = requiredEnv("ZAIO_SSO_CLIENT_SECRET");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; message?: string; user?: ZaioSsoUser }
    | null;

  if (!response.ok || !payload?.success || !payload.user) {
    throw new Error(payload?.message || "Zaio SSO token exchange failed");
  }
  if (payload.user.accBlocked) {
    throw new Error("This Zaio LMS account is blocked.");
  }

  return payload.user;
}

/** SSO-only accounts get an unusable random password hash. */
export async function unusablePasswordHash(): Promise<string> {
  return hashPassword(randomBytes(32).toString("base64url"));
}
