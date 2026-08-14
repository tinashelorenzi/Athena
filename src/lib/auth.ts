import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getSessionLifetimeMs } from "@/lib/settings";
import type { Role } from "@/generated/prisma/enums";

/**
 * Session / authorization layer (server-only).
 *
 * Sessions are database-backed: the browser holds an opaque random token in an
 * HttpOnly cookie, and only the token's SHA-256 hash is stored in the DB. This
 * makes sessions revocable (logout / expiry actually invalidate them) and means
 * a DB leak can't be replayed as a valid cookie.
 *
 * These functions must only run on the server (layouts, Server Actions, Route
 * Handlers). `cookieStore.set()` / `.delete()` may only be called from a Server
 * Action or Route Handler — never during a Server Component render.
 */
const COOKIE_NAME = "athena_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Whether the session cookie is marked `Secure`. Defaults to on in production,
 * but `SESSION_COOKIE_SECURE=false` forces it off so login works over plain HTTP
 * (e.g. an HTTP staging box). `SESSION_COOKIE_SECURE=true` forces it on.
 */
function secureCookieEnabled(): boolean {
  const flag = process.env.SESSION_COOKIE_SECURE;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "production";
}

/** Home route for a role, used after login and for role mismatches. */
export function homeForRole(role: Role): string {
  return role === "SUPER_ADMIN" ? "/admin" : "/learn";
}

/** Create a session for `userId` and set the cookie. Server Action / Route Handler only. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (await getSessionLifetimeMs()));

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: secureCookieEnabled(),
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

/** Delete the current session and clear the cookie. Server Action / Route Handler only. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {});
    cookieStore.delete(COOKIE_NAME);
  }
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isArchitect: boolean;
};

/**
 * Resolve the authenticated user from the session cookie, or `null`.
 * Memoized per request via React `cache` so multiple callers (layout, page,
 * action) share one DB lookup. Safe to call during render (reads the cookie
 * only — never writes it).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, email: true, name: true, role: true, isArchitect: true } },
    },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    // Expired — clean it up (DB write during render is fine; cookie clears on
    // the next Server Action / navigation).
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
});

/** Require any authenticated user; redirect to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require a specific role. Redirects unauthenticated users to /login and
 * wrong-role users to their own home (rather than exposing a 403).
 */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) redirect(homeForRole(user.role));
  return user;
}

/**
 * Require an instructor with the elevated `architect` attribute (may author
 * scenarios). Redirects non-instructors home and instructors-without-architect
 * back to the dashboard.
 */
export async function requireArchitect(): Promise<SessionUser> {
  const user = await requireRole("SUPER_ADMIN");
  if (!user.isArchitect) redirect("/admin");
  return user;
}
