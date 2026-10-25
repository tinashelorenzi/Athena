/**
 * {{…}} placeholders in collect arguments and briefs (docs/labs/spec.md 9.5):
 *   {{param.<name>}}  {{asset.<name>}}  {{session.nonce}}  {{machine.<role>.hostname}}
 * Athena renders them before signing a bundle; the agent never sees braces.
 */

export type TemplateRef =
  | { raw: string; kind: "param"; name: string }
  | { raw: string; kind: "asset"; name: string }
  | { raw: string; kind: "session"; name: "nonce" | "id" }
  | { raw: string; kind: "machine"; role: string; field: "hostname" }
  | { raw: string; kind: "invalid"; reason: string };

const PLACEHOLDER = /\{\{\s*([^{}]*?)\s*\}\}/g;

export function templateRefs(text: string): TemplateRef[] {
  const refs: TemplateRef[] = [];
  for (const m of text.matchAll(PLACEHOLDER)) {
    const raw = m[0];
    const parts = m[1].split(".");
    if (parts[0] === "param" && parts.length === 2 && parts[1]) refs.push({ raw, kind: "param", name: parts[1] });
    else if (parts[0] === "asset" && parts.length === 2 && parts[1]) refs.push({ raw, kind: "asset", name: parts[1] });
    else if (parts[0] === "session" && parts.length === 2 && (parts[1] === "nonce" || parts[1] === "id")) {
      refs.push({ raw, kind: "session", name: parts[1] });
    } else if (parts[0] === "machine" && parts.length === 3 && parts[2] === "hostname") {
      refs.push({ raw, kind: "machine", role: parts[1], field: "hostname" });
    } else {
      refs.push({ raw, kind: "invalid", reason: `unknown placeholder ${raw} (use param.x, asset.x, session.nonce or machine.<role>.hostname)` });
    }
  }
  return refs;
}

export type TemplateValues = {
  param?: Record<string, string | number>;
  asset?: Record<string, string>;
  session?: { nonce?: string; id?: string };
  machine?: Record<string, { hostname: string }>;
};

/** Replace every placeholder; unknown values are left as-is so a mistake is visible. */
export function renderTemplate(text: string, v: TemplateValues): string {
  return text.replace(PLACEHOLDER, (raw, inner: string) => {
    const p = inner.split(".");
    let out: string | number | undefined;
    if (p[0] === "param") out = v.param?.[p[1]];
    else if (p[0] === "asset") out = v.asset?.[p[1]];
    else if (p[0] === "session") out = p[1] === "nonce" ? v.session?.nonce : p[1] === "id" ? v.session?.id : undefined;
    else if (p[0] === "machine" && p[2] === "hostname") out = v.machine?.[p[1]]?.hostname;
    return out === undefined ? raw : String(out);
  });
}
