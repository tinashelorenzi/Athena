"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export type OnboardingState = { error?: string };

/**
 * First-login setup for a bulk-created student: set their name (and optionally a
 * new password), clear the `mustSetName` flag, then enter the lab.
 */
export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter your full name." };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const data: { name: string; mustSetName: boolean; passwordHash?: string } = { name, mustSetName: false };
  if (password) {
    if (password.length < 10) return { error: "New password must be at least 10 characters." };
    if (password !== confirm) return { error: "Passwords don't match." };
    data.passwordHash = await hashPassword(password);
  }

  await prisma.user.update({ where: { id: user.id }, data });
  // Outside any try/catch — redirect() throws NEXT_REDIRECT internally.
  redirect("/learn");
}
