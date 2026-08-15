"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, createSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isMailConfigured, sendMail } from "@/lib/mailer";
import { getBaseUrl } from "@/lib/url";
import { newInviteToken, hashInviteToken, invitationEmailHtml, INVITE_TTL_MS } from "@/lib/invitations";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteState = { error?: string; ok?: string };

async function readEmails(formData: FormData): Promise<string[]> {
  const file = formData.get("emailsFile");
  let text = "";
  if (file instanceof File && file.size > 0) text = await file.text();
  else text = String(formData.get("emailsText") ?? "");
  const emails = text.split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return [...new Set(emails)];
}

/**
 * Bulk-invite students by email. Accepts a .txt upload (one email per line) or
 * pasted list, attaches them to an existing or newly-created cohort, and emails
 * each a tokened link to set their name + password.
 */
export async function sendInvitations(
  _prevState: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const admin = await requireRole("SUPER_ADMIN");

  if (!(await isMailConfigured())) {
    return { error: "Configure SMTP in Settings → Mail before sending invitations." };
  }

  const emails = await readEmails(formData);
  if (emails.length === 0) return { error: "Provide at least one email address." };

  // Resolve cohort: new name takes precedence, else an existing id, else none.
  const newCohortName = String(formData.get("newCohortName") ?? "").trim();
  let cohortId: string | null = String(formData.get("cohortId") ?? "") || null;
  if (newCohortName) {
    const cohort = await prisma.cohort.upsert({
      where: { name: newCohortName },
      update: {},
      create: { name: newCohortName, createdById: admin.id },
    });
    cohortId = cohort.id;
  }

  const url = await getBaseUrl();
  const cohort = cohortId ? await prisma.cohort.findUnique({ where: { id: cohortId } }) : null;

  let sent = 0;
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const email of emails) {
    if (!EMAIL_RE.test(email)) { skipped.push(email); continue; }
    if (await prisma.user.findUnique({ where: { email } })) { skipped.push(email); continue; }

    // Replace any prior pending invite for this email.
    await prisma.invitation.deleteMany({ where: { email, acceptedAt: null } });

    const { raw, hash } = newInviteToken();
    await prisma.invitation.create({
      data: { email, tokenHash: hash, cohortId, invitedById: admin.id, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
    });

    try {
      await sendMail({
        to: email,
        subject: "You're invited to the Athena SOC Lab",
        html: invitationEmailHtml({ baseUrl: url, acceptUrl: `${url}/invite/${raw}`, cohortName: cohort?.name }),
        text: `You've been invited to the Athena SOC Lab. Set up your account: ${url}/invite/${raw}`,
      });
      sent++;
    } catch {
      failed.push(email);
    }
  }

  revalidatePath("/admin/cohorts");
  if (cohortId) revalidatePath(`/admin/cohorts/${cohortId}`);

  const parts = [`Sent ${sent} invitation${sent === 1 ? "" : "s"}`];
  if (skipped.length) parts.push(`skipped ${skipped.length} (invalid or already a user)`);
  if (failed.length) parts.push(`${failed.length} failed to send`);
  return failed.length && sent === 0 ? { error: parts.join(" · ") } : { ok: parts.join(" · ") };
}

export async function revokeInvitation(invitationId: string): Promise<{ error?: string }> {
  await requireRole("SUPER_ADMIN");
  const inv = await prisma.invitation.findUnique({ where: { id: invitationId } });
  await prisma.invitation.delete({ where: { id: invitationId } }).catch(() => {});
  if (inv?.cohortId) revalidatePath(`/admin/cohorts/${inv.cohortId}`);
  revalidatePath("/admin/cohorts");
  return {};
}

export type AcceptState = { error?: string };

/** Complete an invitation: set name + password, create the STUDENT account. */
export async function acceptInvitation(
  token: string,
  _prevState: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash: hashInviteToken(token) } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() < Date.now()) {
    return { error: "This invitation link is invalid or has expired. Ask your instructor to re-send it." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (!name) return { error: "Enter your name." };
  if (password.length < 10) return { error: "Password must be at least 10 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  if (await prisma.user.findUnique({ where: { email: invitation.email } })) {
    return { error: "An account already exists for this email. Try signing in instead." };
  }

  const user = await prisma.user.create({
    data: {
      email: invitation.email,
      name,
      passwordHash: await hashPassword(password),
      role: "STUDENT",
      cohortId: invitation.cohortId,
    },
  });
  await prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });

  await createSession(user.id);
  redirect("/alerts");
}
