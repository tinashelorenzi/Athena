import { createHmac } from "node:crypto";

export type ZaioDojoCompletePayload = {
  zaioUserId: string;
  refToken: string;
  scenarioId: string;
  lectureId?: string;
  completedAt?: string;
  score?: number;
  maxScore?: number;
};

function webhookUrl(): string | null {
  const url = process.env.ZAIO_WEBHOOK_URL?.trim();
  return url || null;
}

function webhookSecret(): string | null {
  return (
    process.env.ZAIO_WEBHOOK_SECRET?.trim() ||
    process.env.ZAIO_SSO_CLIENT_SECRET?.trim() ||
    null
  );
}

export function isZaioDojoWebhookEnabled(): boolean {
  return Boolean(webhookUrl() && webhookSecret());
}

/**
 * Notify Zaio LMS that a student completed all flags in an Athena Dojo scenario.
 * Non-throwing; logs failures.
 */
export async function notifyZaioDojoComplete(
  payload: ZaioDojoCompletePayload,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const url = webhookUrl();
  const secret = webhookSecret();

  if (!url || !secret) {
    return { ok: true, skipped: true };
  }

  if (!payload.zaioUserId?.trim() || !payload.refToken?.trim()) {
    return { ok: false, error: "Missing zaioUserId or refToken" };
  }

  const body = JSON.stringify({
    zaioUserId: payload.zaioUserId.trim(),
    refToken: payload.refToken.trim(),
    scenarioId: payload.scenarioId,
    lectureId: payload.lectureId?.trim() || undefined,
    completedAt: payload.completedAt || new Date().toISOString(),
    score: payload.score,
    maxScore: payload.maxScore,
  });

  const signature = createHmac("sha256", secret).update(body).digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Athena-Signature": signature,
      },
      body,
      cache: "no-store",
    });

    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

    if (!res.ok) {
      const msg = data?.error || res.statusText || "Zaio webhook failed";
      console.error("[zaio-webhook] dojo-complete failed:", res.status, msg);
      return { ok: false, error: msg };
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[zaio-webhook] dojo-complete error:", msg);
    return { ok: false, error: msg };
  }
}
