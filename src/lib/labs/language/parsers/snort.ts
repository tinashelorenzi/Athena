import { kv } from "./generic";
import type { Parser } from "./types";

/**
 * snort_rules — Snort 2 rules (local.rules and friends) into one record per
 * active rule:
 *
 *   action, proto, src, src_port, direction, dst, dst_port,
 *   msg, sid, rev, gid, classtype (null when absent),
 *   contents[]  content strings without quotes ("!" negation dropped; see negated[])
 *   negated[]   which contents were negated, same order
 *   pcres[]     pcre values
 *   options[]   every option {name, value} in order; opts: name → first value
 *   line, raw
 *
 * Commented-out rules, blank lines and non-rule lines (var, include, config …)
 * are skipped. Lines ending in "\" continue on the next line.
 */

const ACTIONS = new Set(["alert", "log", "pass", "activate", "dynamic", "drop", "reject", "sdrop"]);

export type SnortRule = {
  action: string;
  proto: string;
  src: string;
  src_port: string;
  direction: string;
  dst: string;
  dst_port: string;
  msg: string | null;
  sid: number | null;
  rev: number | null;
  gid: number | null;
  classtype: string | null;
  contents: string[];
  negated: boolean[];
  pcres: string[];
  options: { name: string; value: string }[];
  opts: Record<string, string>;
  line: number;
  raw: string;
};

/** Split "a; b:"x;y"; c" on semicolons outside quotes; handles \" and \; escapes. */
function splitOptions(body: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\" && i + 1 < body.length) { cur += c + body[i + 1]; i++; continue; }
    if (c === '"') quoted = !quoted;
    if (c === ";" && !quoted) { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const unquote = (v: string) => {
  const t = v.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1).replace(/\\(["\\;:])/g, "$1") : t;
};
const toInt = (v: string | undefined) => (v !== undefined && /^\d+$/.test(v.trim()) ? Number(v.trim()) : null);

export function parseRule(raw: string, line: number): SnortRule | null {
  const open = raw.indexOf("(");
  const close = raw.lastIndexOf(")");
  if (open === -1 || close < open) return null;
  const head = raw.slice(0, open).trim().split(/\s+/);
  if (head.length !== 7 || !ACTIONS.has(head[0].toLowerCase())) return null;
  const [action, proto, src, src_port, direction, dst, dst_port] = head;

  const options: { name: string; value: string }[] = [];
  for (const opt of splitOptions(raw.slice(open + 1, close))) {
    const i = opt.indexOf(":");
    options.push(i === -1 ? { name: opt.trim().toLowerCase(), value: "" } : { name: opt.slice(0, i).trim().toLowerCase(), value: opt.slice(i + 1).trim() });
  }
  const opts: Record<string, string> = {};
  for (const o of options) if (!(o.name in opts)) opts[o.name] = o.value;

  const contentOpts = options.filter((o) => o.name === "content" || o.name === "uricontent");
  return {
    action: action.toLowerCase(),
    proto: proto.toLowerCase(),
    src, src_port, direction, dst, dst_port,
    msg: "msg" in opts ? unquote(opts.msg) : null,
    sid: toInt(opts.sid),
    rev: toInt(opts.rev),
    gid: toInt(opts.gid),
    classtype: opts.classtype ?? null,
    contents: contentOpts.map((o) => unquote(o.value.replace(/^!\s*/, ""))),
    negated: contentOpts.map((o) => o.value.startsWith("!")),
    pcres: options.filter((o) => o.name === "pcre").map((o) => unquote(o.value)),
    options,
    opts,
    line,
    raw,
  };
}

export const snortRules: Parser = {
  name: "snort_rules",
  version: 1,
  description: "Snort 2 rules into one record per active rule (action, msg, sid, contents …).",
  options: [],
  parse(text) {
    const rules: SnortRule[] = [];
    const src = text.replace(/\r\n?/g, "\n").split("\n");
    for (let i = 0; i < src.length; i++) {
      const start = i + 1;
      let l = src[i];
      while (/\\\s*$/.test(l) && i + 1 < src.length) l = l.replace(/\\\s*$/, " ") + src[++i].trim();
      const t = l.trim();
      if (!t || t.startsWith("#")) continue;
      const rule = parseRule(t, start);
      if (rule) rules.push(rule);
    }
    return rules;
  },
};

/** sshd — `sshd -T` (effective config): lowercase keys → value, plus `_all` for repeated keys. */
export const sshd: Parser = {
  name: "sshd",
  version: 1,
  description: "`sshd -T` output into a map of lowercase option → value (`_all` keeps repeats).",
  options: [],
  parse(text) {
    return kv.parse(text, { lower_keys: true, comment: "#" });
  },
};
