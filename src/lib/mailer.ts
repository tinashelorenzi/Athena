import nodemailer from "nodemailer";
import { getMailSettingsInternal } from "@/lib/settings";

/**
 * Outbound mail using the platform SMTP settings (Settings → Mail). Server-only.
 */
export async function isMailConfigured(): Promise<boolean> {
  const cfg = await getMailSettingsInternal();
  return Boolean(cfg.host);
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const cfg = await getMailSettingsInternal();
  if (!cfg.host) throw new Error("SMTP is not configured (Settings → Mail).");

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
  });

  const from = cfg.fromName
    ? `"${cfg.fromName}" <${cfg.fromAddress || cfg.user}>`
    : cfg.fromAddress || cfg.user;

  await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}
