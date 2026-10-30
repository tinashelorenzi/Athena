/**
 * {{…}} placeholders in collect arguments and briefs (docs/labs/spec.md 9.5):
 *   {{param.<name>}}  {{asset.<name>}}  {{session.nonce}}  {{machine.<role>.hostname}}
 * Athena renders them before signing a bundle; the agent never sees braces.
 * Briefs can also use {{script.<name>}} (the student's curl command for a lab
 * script) and {{script.<name>.url}} (just its link); see docs/labs/scripts.md.
 */

export type TemplateRef =
  | { raw: string; kind: "param"; name: string }
  | { raw: string; kind: "asset"; name: string }
  | { raw: string; kind: "session"; name: "nonce" | "id" }
  | { raw: string; kind: "machine"; role: string; field: "hostname" }
  | { raw: string; kind: "script"; name: string; form: "command" | "url" }
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
    } else if (parts[0] === "script" && parts[1] && (parts.length === 2 || (parts.length === 3 && parts[2] === "url"))) {
      refs.push({ raw, kind: "script", name: parts[1], form: parts.length === 3 ? "url" : "command" });
    } else {
      refs.push({ raw, kind: "invalid", reason: `unknown placeholder ${raw} (use param.x, asset.x, session.nonce, machine.<role>.hostname, script.x or script.x.url)` });
    }
  }
  return refs;
}

export type TemplateValues = {
  param?: Record<string, string | number>;
  asset?: Record<string, string>;
  session?: { nonce?: string; id?: string };
  machine?: Record<string, { hostname: string }>;
  /** Script name → the student's short link to it. */
  script?: Record<string, string>;
};

/** What {{script.<name>}} becomes: fetch the script and run it as root. */
export const scriptCommand = (url: string) => `curl -fsSL ${url} | sudo bash`;

/** Replace every placeholder; unknown values are left as-is so a mistake is visible. */
export function renderTemplate(text: string, v: TemplateValues): string {
  return text.replace(PLACEHOLDER, (raw, inner: string) => {
    const p = inner.split(".");
    let out: string | number | undefined;
    if (p[0] === "param") out = v.param?.[p[1]];
    else if (p[0] === "asset") out = v.asset?.[p[1]];
    else if (p[0] === "session") out = p[1] === "nonce" ? v.session?.nonce : p[1] === "id" ? v.session?.id : undefined;
    else if (p[0] === "machine" && p[2] === "hostname") out = v.machine?.[p[1]]?.hostname;
    else if (p[0] === "script" && v.script?.[p[1]] && (p.length === 2 || p[2] === "url")) out = p.length === 2 ? scriptCommand(v.script[p[1]]) : v.script[p[1]];
    return out === undefined ? raw : String(out);
  });
}
