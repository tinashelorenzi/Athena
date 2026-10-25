import { parse as parseYaml } from "yaml";
import { ParseError, type Parser } from "./types";

/* Generic parsers: enough to grade most tools without writing a new parser. */

const str = (v: unknown, def: string) => (typeof v === "string" ? v : def);
const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
const splitLines = (text: string) => text.replace(/\r\n?/g, "\n").split("\n");

function stripComment(line: string, comment: string): string {
  if (!comment) return line;
  const i = line.indexOf(comment);
  return i === -1 ? line : line.slice(0, i);
}

/** lines — one string per line. Options: trim (true), skip_empty (true), comment ("" = keep). */
export const lines: Parser = {
  name: "lines",
  version: 1,
  description: "One string per line.",
  options: ["trim", "skip_empty", "comment"],
  parse(text, o) {
    const trim = bool(o.trim, true);
    const skipEmpty = bool(o.skip_empty, true);
    const comment = str(o.comment, "");
    return splitLines(text)
      .map((l) => stripComment(l, comment))
      .map((l) => (trim ? l.trim() : l))
      .filter((l) => !skipEmpty || l.trim() !== "");
  },
};

/**
 * kv — `key value` / `key=value` lines into a map (last value wins), plus
 * `_all`: key → every value in order. Options: sep (whitespace), comment ("#"),
 * lower_keys (false).
 */
export const kv: Parser = {
  name: "kv",
  version: 1,
  description: "Key/value lines into a map; `_all` keeps every value per key.",
  options: ["sep", "comment", "lower_keys"],
  parse(text, o) {
    const sep = str(o.sep, "");
    const comment = str(o.comment, "#");
    const lower = bool(o.lower_keys, false);
    const out: Record<string, unknown> = {};
    const all: Record<string, string[]> = {};
    for (const rawLine of splitLines(text)) {
      const line = stripComment(rawLine, comment).trim();
      if (!line) continue;
      let key: string;
      let value: string;
      if (sep) {
        const i = line.indexOf(sep);
        if (i === -1) continue;
        key = line.slice(0, i).trim();
        value = line.slice(i + sep.length).trim();
      } else {
        const m = line.match(/^(\S+)\s*(.*)$/);
        if (!m) continue;
        [, key, value] = m;
      }
      if (lower) key = key.toLowerCase();
      if (key === "_all") continue;
      out[key] = value;
      (all[key] ??= []).push(value);
    }
    out._all = all;
    return out;
  },
};

/**
 * ini — `[section]` / `key = value` into { section: { key: value } }.
 * Keys before any section go in `_global`. Indented lines continue the
 * previous value (fail2ban style). Comments start with # or ;.
 */
export const ini: Parser = {
  name: "ini",
  version: 1,
  description: "INI sections into { section: { key: value } }.",
  options: ["lower_keys"],
  parse(text, o) {
    const lower = bool(o.lower_keys, false);
    const out: Record<string, Record<string, string>> = { _global: {} };
    let section = out._global;
    let lastKey: string | null = null;
    for (const raw of splitLines(text)) {
      if (/^\s*[#;]/.test(raw) || !raw.trim()) {
        if (!raw.trim()) lastKey = null;
        continue;
      }
      const sec = raw.match(/^\s*\[([^\]]+)\]\s*$/);
      if (sec) {
        const name = sec[1].trim();
        section = out[name] ??= {};
        lastKey = null;
        continue;
      }
      if (/^\s+\S/.test(raw) && lastKey) {
        section[lastKey] = `${section[lastKey]}\n${raw.trim()}`.trim();
        continue;
      }
      const m = raw.match(/^\s*([^=:]+?)\s*[=:]\s*(.*?)\s*$/);
      if (!m) continue;
      const key = lower ? m[1].toLowerCase() : m[1];
      section[key] = m[2];
      lastKey = key;
    }
    return out;
  },
};

export const json: Parser = {
  name: "json",
  version: 1,
  description: "A JSON document.",
  options: [],
  parse(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new ParseError(`not valid JSON: ${e instanceof Error ? e.message : e}`);
    }
  },
};

/** jsonl — one JSON value per line (e.g. Suricata eve.json). Unparseable lines are skipped. */
export const jsonl: Parser = {
  name: "jsonl",
  version: 1,
  description: "One JSON value per line; bad lines are skipped.",
  options: [],
  parse(text) {
    const out: unknown[] = [];
    let bad = 0;
    for (const line of splitLines(text)) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        bad++;
      }
    }
    if (bad && !out.length) throw new ParseError("no line is valid JSON");
    return out;
  },
};

export const yaml: Parser = {
  name: "yaml",
  version: 1,
  description: "A YAML document.",
  options: [],
  parse(text) {
    try {
      return parseYaml(text) ?? null;
    } catch (e) {
      throw new ParseError(`not valid YAML: ${e instanceof Error ? e.message : e}`);
    }
  },
};

/** csv — RFC 4180-ish (quotes, doubled quotes). header (true) → list of objects, else list of lists. */
export const csv: Parser = {
  name: "csv",
  version: 1,
  description: "CSV rows; with a header row, a list of objects.",
  options: ["header", "sep"],
  validate: (o) => (o.sep !== undefined && (typeof o.sep !== "string" || o.sep.length !== 1) ? "sep must be one character" : null),
  parse(text, o) {
    const sep = str(o.sep, ",");
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;
    const t = text.replace(/\r\n?/g, "\n");
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (quoted) {
        if (c === '"' && t[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"' && field === "") quoted = true;
      else if (c === sep) { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    const data = rows.filter((r) => !(r.length === 1 && r[0] === ""));
    if (!bool(o.header, true)) return data;
    const [head, ...body] = data;
    if (!head) return [];
    return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
  },
};

const colName = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "col";

/**
 * table — whitespace-separated columns (ps, ss, df …). With header (true) the
 * first row names the columns (lowercased, non-alphanumerics → _); the last
 * column keeps the rest of the line. columns: fixed column count without a header.
 */
export const table: Parser = {
  name: "table",
  version: 1,
  description: "Whitespace-separated columns; the last column keeps the rest of the line.",
  options: ["header", "columns", "skip"],
  validate: (o) => (o.columns !== undefined && (!Number.isInteger(o.columns) || (o.columns as number) < 1) ? "columns must be a positive integer" : null),
  parse(text, o) {
    const skip = Number.isInteger(o.skip) ? (o.skip as number) : 0;
    const rows = splitLines(text).slice(skip).filter((l) => l.trim());
    const header = bool(o.header, true);
    let names: string[];
    if (header) {
      const head = rows.shift();
      if (!head) return [];
      names = head.trim().split(/\s+/).map(colName);
      const seen: Record<string, number> = {};
      names = names.map((n) => (seen[n] = (seen[n] ?? 0) + 1) > 1 ? `${n}_${seen[n]}` : n);
    } else {
      const n = Number.isInteger(o.columns) ? (o.columns as number) : 0;
      if (!n) return rows.map((r) => r.trim().split(/\s+/));
      names = Array.from({ length: n }, (_, i) => `c${i + 1}`);
    }
    return rows.map((r) => {
      const parts = r.trim().split(/\s+/);
      const head = parts.slice(0, names.length - 1);
      const rest = parts.slice(names.length - 1).join(" ");
      return Object.fromEntries(names.map((n, i) => [n, i < names.length - 1 ? head[i] ?? "" : rest]));
    });
  },
};

/**
 * regex — one record per match of `pattern` (named groups → fields). Flags
 * default to "gm"; `g` is always added.
 */
export const regex: Parser = {
  name: "regex",
  version: 1,
  description: "One record per match; named groups become fields.",
  options: ["pattern", "flags"],
  validate(o) {
    if (typeof o.pattern !== "string" || !o.pattern) return "pattern is required";
    if (o.flags !== undefined && (typeof o.flags !== "string" || !/^[imsu]*$/.test(o.flags))) return "flags may only contain i, m, s, u";
    try {
      const re = new RegExp(o.pattern, "g" + (typeof o.flags === "string" ? o.flags : "m"));
      if (!/\(\?<[A-Za-z_][A-Za-z0-9_]*>/.test(re.source)) return "pattern needs at least one named group, e.g. (?<sid>\\d+)";
    } catch (e) {
      return `invalid pattern: ${e instanceof Error ? e.message : e}`;
    }
    return null;
  },
  parse(text, o) {
    const re = new RegExp(String(o.pattern), "g" + (typeof o.flags === "string" ? o.flags : "m"));
    const out: Record<string, string>[] = [];
    for (const m of text.matchAll(re)) {
      if (m[0] === "") continue;
      out.push(Object.fromEntries(Object.entries(m.groups ?? {}).map(([k, v]) => [k, v ?? ""])));
      if (out.length >= 10000) break;
    }
    return out;
  },
};
