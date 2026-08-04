import { createHash, randomBytes } from "node:crypto";

/**
 * Student invitation tokens. The raw token goes in the emailed link; only its
 * SHA-256 hash is stored (like sessions / API keys).
 */
export function hashInviteToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newInviteToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashInviteToken(raw) };
}

export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/** Branded HTML for the invitation email (Zaio logo + accept button). */
export function invitationEmailHtml(opts: {
  baseUrl: string;
  acceptUrl: string;
  cohortName?: string | null;
}): string {
  const logo = `${opts.baseUrl}/logo.1a24392f.png`;
  const cohortLine = opts.cohortName
    ? `<p style="margin:0 0 20px;font-size:14px;color:#9aa0b4;">Cohort: <strong style="color:#d6d9e6;">${escapeHtml(opts.cohortName)}</strong></p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#06070f;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06070f;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#0c0e1e;border:1px solid #1b1f33;border-radius:14px;overflow:hidden;">
          <tr><td style="padding:28px 32px 8px;">
            <img src="${logo}" alt="Zaio Institute of Technology" height="28" style="display:block;height:28px;width:auto;" />
          </td></tr>
          <tr><td style="padding:8px 32px 28px;">
            <h1 style="margin:16px 0 12px;font-size:22px;line-height:1.25;color:#ffffff;font-weight:700;">You're invited to the Athena SOC Lab</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#c7cbd9;">
              Your instructor has invited you to Athena — Zaio's Security Operations Center simulation lab. Click below to set your name and password and get started.
            </p>
            ${cohortLine}
            <a href="${opts.acceptUrl}" style="display:inline-block;background:#2326b8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:8px;">Accept invitation</a>
            <p style="margin:22px 0 0;font-size:12.5px;line-height:1.6;color:#7b8199;">
              Or paste this link into your browser:<br />
              <span style="color:#9aa0b4;word-break:break-all;">${opts.acceptUrl}</span>
            </p>
            <p style="margin:16px 0 0;font-size:12.5px;color:#7b8199;">This link expires in 14 days.</p>
          </td></tr>
        </table>
        <p style="margin:18px 0 0;font-size:11.5px;color:#5a5f72;">© 2026 Zaio Institute of Technology · For authorized students only</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
