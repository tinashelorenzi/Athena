"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, destroySession, homeForRole } from "@/lib/auth";
import { getTurnstilePublic } from "@/lib/settings";
import { verifyTurnstileToken } from "@/lib/turnstile";

export type LoginState = { error?: string };

/**
 * Login Server Action (used with `useActionState`, so the signature is
 * `(prevState, formData)`). Verifies credentials with Argon2id, opens a
 * session, then redirects to the role's home. The same form serves both
 * instructors (SUPER_ADMIN → /admin) and students (STUDENT → /alerts).
 */
export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  // Bot protection: if Turnstile is enabled, require and verify the token first.
  const { enabled: turnstileEnabled } = await getTurnstilePublic();
  if (turnstileEnabled) {
    const token = String(formData.get("cf-turnstile-response") ?? "");
    if (!token) return { error: "Please complete the bot-protection challenge." };
    if (!(await verifyTurnstileToken(token))) {
      return { error: "Bot-protection check failed. Please try again." };
    }
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(user.passwordHash, password) : false;

  // One generic message for both cases so we don't reveal which emails exist.
  if (!ok || !user) {
    return { error: "Invalid email or password." };
  }

  await createSession(user.id);
  // Must be outside any try/catch — redirect() throws NEXT_REDIRECT internally.
  redirect(homeForRole(user.role));
}

/** Logout Server Action: revoke the session and return to the login page. */
export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
