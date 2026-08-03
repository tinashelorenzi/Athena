"use server";

import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  saveSecuritySettings as saveSecurity,
  saveMailSettings as saveMail,
  saveStorageSettings as saveStorage,
  getSecuritySettings,
  getMailSettingsInternal,
} from "@/lib/settings";
import { testStorage } from "@/lib/storage";

export type SettingsState = { error?: string; ok?: string };

/** Update the signed-in user's display name. */
export async function updateProfile(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name cannot be empty." };

  await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/admin/settings");
  return { ok: "Profile updated." };
}

/** Change the signed-in user's password (verifies the current one first). */
export async function changePassword(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current || !next) return { error: "Fill in all password fields." };
  if (next.length < 10) {
    return { error: "New password must be at least 10 characters." };
  }
  if (next !== confirm) return { error: "New passwords don't match." };

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record || !(await verifyPassword(record.passwordHash, current))) {
    return { error: "Current password is incorrect." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });
  return { ok: "Password changed." };
}

// ── Platform: Security ──────────────────────────────────────────────────────
export async function saveSecuritySettings(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("SUPER_ADMIN");

  const turnstileEnabled = formData.get("turnstileEnabled") === "on";
  const turnstileSiteKey = String(formData.get("turnstileSiteKey") ?? "").trim();
  // Empty secret = keep the existing one.
  const secretInput = String(formData.get("turnstileSecretKey") ?? "").trim();
  const sessionLifetimeDays = Math.min(90, Math.max(1, Number(formData.get("sessionLifetimeDays")) || 7));

  if (turnstileEnabled) {
    const current = await getSecuritySettings();
    if (!turnstileSiteKey) return { error: "A Turnstile site key is required to enable bot protection." };
    if (!secretInput && !current.turnstileSecretConfigured) {
      return { error: "A Turnstile secret key is required to enable bot protection." };
    }
  }

  await saveSecurity({
    turnstileEnabled,
    turnstileSiteKey,
    turnstileSecretKey: secretInput || undefined,
    sessionLifetimeDays,
  });

  revalidatePath("/admin/settings");
  return { ok: "Security settings saved." };
}

// ── Platform: Mail (SMTP) ───────────────────────────────────────────────────
export async function saveMailSettings(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("SUPER_ADMIN");

  const host = String(formData.get("host") ?? "").trim();
  const port = Number(formData.get("port")) || 587;
  const secure = formData.get("secure") === "on";
  const user = String(formData.get("user") ?? "").trim();
  const password = String(formData.get("password") ?? ""); // empty = keep existing
  const fromName = String(formData.get("fromName") ?? "").trim();
  const fromAddress = String(formData.get("fromAddress") ?? "").trim();

  if (host && (port < 1 || port > 65535)) return { error: "Port must be between 1 and 65535." };
  if (fromAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress)) {
    return { error: "From address must be a valid email." };
  }

  await saveMail({ host, port, secure, user, password: password || undefined, fromName, fromAddress });

  revalidatePath("/admin/settings");
  return { ok: "Mail settings saved." };
}

/** Send a test email using the stored SMTP settings to prove they work. */
export async function sendTestEmail(to: string): Promise<SettingsState> {
  await requireRole("SUPER_ADMIN");

  const recipient = to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { error: "Enter a valid recipient email." };
  }

  const cfg = await getMailSettingsInternal();
  if (!cfg.host) return { error: "Configure and save SMTP settings first." };

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
    });

    await transporter.sendMail({
      from: cfg.fromName ? `"${cfg.fromName}" <${cfg.fromAddress || cfg.user}>` : cfg.fromAddress || cfg.user,
      to: recipient,
      subject: "Athena SMTP test",
      text: "This is a test email from your Athena platform. If you received it, SMTP is configured correctly.",
    });

    return { ok: `Test email sent to ${recipient}.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { error: `Send failed: ${msg}` };
  }
}

// ── Platform: Storage (S3 / MinIO) ──────────────────────────────────────────
export async function saveStorageSettings(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("SUPER_ADMIN");

  const provider = formData.get("provider") === "minio" ? "minio" : "s3";
  const endpoint = String(formData.get("endpoint") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim() || "us-east-1";
  const bucket = String(formData.get("bucket") ?? "").trim();
  const accessKeyId = String(formData.get("accessKeyId") ?? "").trim();
  const secretAccessKey = String(formData.get("secretAccessKey") ?? ""); // empty = keep
  const forcePathStyle = formData.get("forcePathStyle") === "on";

  if (provider === "minio" && !endpoint) {
    return { error: "MinIO requires an endpoint URL (e.g. http://localhost:9000)." };
  }

  await saveStorage({ provider, endpoint, region, bucket, accessKeyId, secretAccessKey: secretAccessKey || undefined, forcePathStyle });
  revalidatePath("/admin/settings");
  return { ok: "Storage settings saved." };
}

/** Verify object-storage credentials by heading the bucket. */
export async function testStorageConnection(): Promise<SettingsState> {
  await requireRole("SUPER_ADMIN");
  const err = await testStorage();
  return err ? { error: `Storage check failed: ${err}` } : { ok: "Storage connection OK." };
}
