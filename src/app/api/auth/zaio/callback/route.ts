import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { createSession, homeForRole } from "@/lib/auth";
import { getBaseUrl } from "@/lib/url";
import { exchangeZaioAuthorizationCode, isZaioSsoEnabled, unusablePasswordHash } from "@/lib/zaio-sso";

const STATE_COOKIE = "athena_zaio_sso_state";
const RETURN_TO_COOKIE = "athena_zaio_sso_return_to";

function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export async function GET(request: Request) {
  // Build redirects from the PUBLIC base URL, not `request.url`. Behind a reverse
  // proxy `request.url` is the internal address (http://localhost:3000/...), so
  // using it would bounce the user to localhost after a successful Zaio sign-in.
  // getBaseUrl() prefers APP_BASE_URL, else X-Forwarded-Host/Proto.
  const base = await getBaseUrl();
  const to = (path: string) => NextResponse.redirect(new URL(path, base));

  if (!isZaioSsoEnabled()) {
    return to("/login?error=sso_disabled");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return to(`/login?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return to("/login?error=missing_code");
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const returnTo = cookieStore.get(RETURN_TO_COOKIE)?.value?.trim();
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(RETURN_TO_COOKIE);

  if (!expectedState || expectedState !== hashState(state)) {
    return to("/login?error=invalid_state");
  }

  try {
    const zaioUser = await exchangeZaioAuthorizationCode(code);
    const email = zaioUser.email.trim().toLowerCase();
    const name = (zaioUser.name || email).trim();
    const studentNumber = zaioUser.studentNumber?.trim() || null;

    let user =
      (await prisma.user.findFirst({
        where: {
          OR: [
            { zaioUserId: zaioUser.id },
            { email },
            ...(studentNumber ? [{ studentNumber }] : []),
          ],
        },
      })) ?? null;

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          zaioUserId: user.zaioUserId ?? zaioUser.id,
          name: user.name || name,
          ...(studentNumber ? { studentNumber } : {}),
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          name,
          zaioUserId: zaioUser.id,
          studentNumber,
          role: "STUDENT",
          passwordHash: await unusablePasswordHash(),
        },
      });
    }

    await createSession(user.id);

    const safeReturnTo =
      returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
        ? returnTo
        : null;
    const destination = safeReturnTo || homeForRole(user.role);
    return to(destination);
  } catch (err) {
    const message = err instanceof Error ? err.message : "sso_failed";
    return to(`/login?error=${encodeURIComponent(message)}`);
  }
}
