import { LineCounter, parseDocument } from "yaml";
import { PARSERS } from "./parsers";
import { RESERVED_NAMES, checkExpression, makeEnv, referencedNames } from "./cel";
import { templateRefs } from "./template";
import {
  ZCL_VERSION,
  type Assertion, type Check, type CollectStep, type CompileIssue, type CompileResult, type CompiledLab,
  type GatherEntry, type GatherItem, type Lifecycle, type MachineRole, type ParamSpec, type ParseSpec, type SessionPolicy,
} from "./types";

/**
 * Compiles lab/lab.yaml (docs/labs/spec.md section 9) into a CompiledLab, or
 * returns every problem found with its YAML line. Pure: no DB, no I/O.
 */

export type CompileOptions = {
  /** Asset names available in lab/assets/ (see assetName). Unset = don't check. */
  assets?: string[];
  /** Largest cohort the lab may be released to; enables the `unique` space check. */
  maxCohortSize?: number;
};

/** lab/assets/sqli.pcap → "sqli_pcap" (used as {{asset.sqli_pcap}}). */
export function assetName(file: string): string {
  return file.split("/").pop()!.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const NAME = /^[a-z][a-z0-9_]{0,39}$/;
const ROLE = /^[a-z][a-z0-9_]{0,23}$/;
const FLAG = /^[A-Z][A-Z0-9_]{1,39}$/;
const PRIMITIVES = ["file", "glob", "run", "service", "package", "log"] as const;
const ITEM_OPTIONS: Record<(typeof PRIMITIVES)[number], string[]> = {
  file: ["max_bytes"],
  glob: ["content", "max_files"],
  run: ["timeout", "stdin", "cwd"],
  service: [],
  package: [],
  log: [],
};
/** Text fields a parse step may read from each primitive's result. */
const TEXT_FIELDS: Record<string, string[]> = { file: ["content"], run: ["stdout", "stderr"], log: ["content"] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

export function compileLab(source: string, opts: CompileOptions = {}): CompileResult {
  const errors: CompileIssue[] = [];
  const warnings: CompileIssue[] = [];
  const lc = new LineCounter();
  const doc = parseDocument(source, { lineCounter: lc, prettyErrors: false, uniqueKeys: true });

  for (const e of doc.errors) errors.push({ path: "", message: e.message.split("\n")[0], line: e.linePos?.[0]?.line ?? lc.linePos(e.pos[0]).line });
  if (errors.length) return { ok: false, errors, warnings };

  const lineOf = (path: (string | number)[]): number | undefined => {
    const node = path.length ? (doc.getIn(path, true) as { range?: number[] } | undefined) : (doc.contents as { range?: number[] } | null);
    const offset = node?.range?.[0];
    if (offset !== undefined) return lc.linePos(offset).line;
    return path.length > 1 ? lineOf(path.slice(0, -1)) : undefined;
  };
  const fmt = (path: (string | number)[]) => path.map((p) => (typeof p === "number" ? `[${p}]` : p)).join(".").replace(/\.\[/g, "[");
  const err = (path: (string | number)[], message: string) => errors.push({ path: fmt(path), message, line: lineOf(path) });
  const warn = (path: (string | number)[], message: string) => warnings.push({ path: fmt(path), message, line: lineOf(path) });
  const unknownKeys = (o: Obj, allowed: string[], path: (string | number)[]) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) err([...path, k], `unknown key "${k}" (expected one of: ${allowed.join(", ")})`);
  };

  const root = doc.toJS({ maxAliasCount: 50 }) as unknown;
  if (!isObj(root)) {
    err([], "lab.yaml must be a mapping with zcl, machines, collect and checks");
    return { ok: false, errors, warnings };
  }
  unknownKeys(root, ["zcl", "session", "machines", "params", "lifecycle", "collect", "parse", "checks"], []);
  if (root.zcl !== ZCL_VERSION) err(["zcl"], `zcl must be ${ZCL_VERSION} (the lab language version)`);

  // ── session ────────────────────────────────────────────────────────────────
  const session: SessionPolicy = { timeLimitMinutes: null, checks: { practice: true, maxPractice: 20, cooldownSeconds: 60, showResults: "dojo" } };
  if (root.session !== undefined) {
    if (!isObj(root.session)) err(["session"], "session must be a mapping");
    else {
      const s = root.session;
      unknownKeys(s, ["timeLimitMinutes", "checks"], ["session"]);
      if (s.timeLimitMinutes !== undefined) {
        if (!isInt(s.timeLimitMinutes) || s.timeLimitMinutes < 5 || s.timeLimitMinutes > 7 * 24 * 60) err(["session", "timeLimitMinutes"], "timeLimitMinutes must be a whole number of minutes between 5 and 10080");
        else session.timeLimitMinutes = s.timeLimitMinutes;
      }
      if (s.checks !== undefined) {
        if (!isObj(s.checks)) err(["session", "checks"], "checks must be a mapping");
        else {
          const c = s.checks;
          unknownKeys(c, ["practice", "maxPractice", "cooldownSeconds", "showResults"], ["session", "checks"]);
          const cp = ["session", "checks"];
          if (c.practice !== undefined) {
            if (typeof c.practice === "boolean") session.checks.practice = c.practice;
            else err([...cp, "practice"], "practice must be true or false");
          }
          if (c.maxPractice !== undefined) {
            if (isInt(c.maxPractice) && c.maxPractice >= 0 && c.maxPractice <= 1000) session.checks.maxPractice = c.maxPractice;
            else err([...cp, "maxPractice"], "maxPractice must be a whole number 0–1000");
          }
          if (c.cooldownSeconds !== undefined) {
            if (isInt(c.cooldownSeconds) && c.cooldownSeconds >= 0 && c.cooldownSeconds <= 3600) session.checks.cooldownSeconds = c.cooldownSeconds;
            else err([...cp, "cooldownSeconds"], "cooldownSeconds must be a whole number 0–3600");
          }
          if (c.showResults !== undefined) {
            if (["dojo", "always", "never"].includes(c.showResults as string)) session.checks.showResults = c.showResults as SessionPolicy["checks"]["showResults"];
            else err([...cp, "showResults"], "showResults must be dojo, always or never");
          }
        }
      }
    }
  }

  // ── machines ───────────────────────────────────────────────────────────────
  const machines: Record<string, MachineRole> = {};
  if (!isObj(root.machines) || !Object.keys(root.machines).length) err(["machines"], "machines must list at least one role, e.g. `web: { os: ubuntu }`");
  else {
    for (const [role, spec] of Object.entries(root.machines)) {
      const p = ["machines", role];
      if (!ROLE.test(role)) { err(p, `role "${role}" must be lowercase letters, digits or _ (max 24)`); continue; }
      const m = isObj(spec) ? spec : spec == null ? {} : null;
      if (!m) { err(p, "a role must be a mapping"); continue; }
      unknownKeys(m, ["os", "versions", "packages"], p);
      const os = m.os ?? "ubuntu";
      if (os !== "ubuntu") err([...p, "os"], "only ubuntu machines are supported");
      const strList = (v: unknown, key: string): string[] => {
        if (v === undefined) return [];
        if (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number")) return v.map(String);
        err([...p, key], `${key} must be a list`);
        return [];
      };
      machines[role] = { os: "ubuntu", versions: strList(m.versions, "versions"), packages: strList(m.packages, "packages") };
    }
  }
  const roles = new Set(Object.keys(machines));

  // ── params ─────────────────────────────────────────────────────────────────
  const params: Record<string, ParamSpec> = {};
  if (root.params !== undefined && !isObj(root.params)) err(["params"], "params must be a mapping");
  for (const [name, raw] of Object.entries(isObj(root.params) ? root.params : {})) {
    const p = ["params", name];
    if (!NAME.test(name) || RESERVED_NAMES.has(name)) { err(p, `"${name}" can't be used as a parameter name`); continue; }
    if (!isObj(raw)) { err(p, "a parameter must be a mapping with a type"); continue; }
    const unique = raw.unique === "cohort" || raw.unique === true;
    if (raw.unique !== undefined && raw.unique !== "cohort" && typeof raw.unique !== "boolean") err([...p, "unique"], "unique must be `cohort` or false");
    let spec: ParamSpec | null = null;
    let space = 0;
    switch (raw.type) {
      case "token": {
        unknownKeys(raw, ["type", "length", "alphabet", "unique"], p);
        const length = raw.length ?? 6;
        const alphabet = raw.alphabet ?? "base32";
        if (!isInt(length) || length < 4 || length > 64) err([...p, "length"], "length must be 4–64");
        else if (!["base32", "hex", "alnum"].includes(alphabet as string)) err([...p, "alphabet"], "alphabet must be base32, hex or alnum");
        else {
          spec = { type: "token", length, alphabet: alphabet as "base32" | "hex" | "alnum", unique };
          space = Math.pow(({ base32: 31, hex: 16, alnum: 36 } as const)[spec.alphabet], length);
        }
        break;
      }
      case "int": {
        unknownKeys(raw, ["type", "min", "max", "step", "unique"], p);
        const step = raw.step ?? 1;
        if (!isInt(raw.min) || !isInt(raw.max) || raw.min > raw.max) err(p, "int needs whole-number min ≤ max");
        else if (!isInt(step) || step < 1) err([...p, "step"], "step must be a whole number ≥ 1");
        else {
          spec = { type: "int", min: raw.min, max: raw.max, step, unique };
          space = Math.floor((raw.max - raw.min) / step) + 1;
        }
        break;
      }
      case "choice":
      case "word": {
        unknownKeys(raw, ["type", "values", "unique"], p);
        const vals = raw.values;
        if (!Array.isArray(vals) || !vals.length || !vals.every((v) => typeof v === "string" || typeof v === "number")) err([...p, "values"], "values must be a non-empty list of strings or numbers");
        else if (new Set(vals.map(String)).size !== vals.length) err([...p, "values"], "values must not repeat");
        else {
          spec = { type: "choice", values: vals as (string | number)[], unique };
          space = vals.length;
        }
        break;
      }
      default:
        err([...p, "type"], "type must be token, int, choice or word");
    }
    if (spec) {
      params[name] = spec;
      if (unique && opts.maxCohortSize && space < opts.maxCohortSize * 4) {
        err(p, `unique: cohort needs at least ${opts.maxCohortSize * 4} possible values (4× the largest cohort of ${opts.maxCohortSize}); this has ${space}`);
      }
    }
  }
  if (!Object.values(params).some((s) => s.type === "token")) {
    warn(["params"], "no token parameter: a per-student token that must appear in the work is what turns similarity into proof of copying");
  }

  // Templates: every string sent to the agent is checked.
  const usedAssets = new Set<string>();
  const checkTemplates = (text: string, path: (string | number)[]) => {
    for (const ref of templateRefs(text)) {
      if (ref.kind === "invalid") err(path, ref.reason);
      else if (ref.kind === "script") err(path, `${ref.raw}: scripts are for the brief (students run them); lab.yaml can't use them`);
      else if (ref.kind === "file") err(path, `${ref.raw}: lab files are for scripts; lab.yaml sends files with {{asset.<name>}} (lab/assets/)`);
      else if (ref.kind === "param" && !params[ref.name]) err(path, `${ref.raw}: no parameter "${ref.name}"`);
      else if (ref.kind === "machine" && !roles.has(ref.role)) err(path, `${ref.raw}: no role "${ref.role}"`);
      else if (ref.kind === "asset") {
        if (opts.assets && !opts.assets.includes(ref.name)) err(path, `${ref.raw}: no file in lab/assets/ named like that (available: ${opts.assets.join(", ") || "none"})`);
        usedAssets.add(ref.name);
      }
    }
  };
  const absPath = (v: unknown, path: (string | number)[], what: string): string | null => {
    if (typeof v !== "string" || !v.trim()) { err(path, `${what} must be a path`); return null; }
    if (!v.startsWith("/") && !v.startsWith("{{")) err(path, `${what} must be an absolute path`);
    checkTemplates(v, path);
    return v;
  };

  // ── lifecycle ──────────────────────────────────────────────────────────────
  const lifecycle: Lifecycle = { baseline: {}, lockdown: null };
  if (root.lifecycle !== undefined) {
    if (!isObj(root.lifecycle)) err(["lifecycle"], "lifecycle must be a mapping");
    else {
      unknownKeys(root.lifecycle, ["baseline", "lockdown"], ["lifecycle"]);
      const b = root.lifecycle.baseline;
      if (b !== undefined) {
        if (!isObj(b)) err(["lifecycle", "baseline"], "baseline must map roles to { hash, logs }");
        else for (const [role, spec] of Object.entries(b)) {
          const p = ["lifecycle", "baseline", role];
          if (!roles.has(role)) { err(p, `no role "${role}" in machines`); continue; }
          if (!isObj(spec)) { err(p, "must be { hash: [...], logs: [...] }"); continue; }
          unknownKeys(spec, ["hash", "logs"], p);
          const list = (key: "hash" | "logs") => {
            const v = spec[key];
            if (v === undefined) return [];
            if (!Array.isArray(v)) { err([...p, key], `${key} must be a list of paths`); return []; }
            return v.map((x, i) => absPath(x, [...p, key, i], "entry")).filter((x): x is string => x !== null);
          };
          lifecycle.baseline[role] = { hash: list("hash"), logs: list("logs") };
        }
      }
      const l = root.lifecycle.lockdown;
      if (l !== undefined && l !== null) {
        if (!isObj(l) || l.ssh !== "off" || Object.keys(l).length !== 1) err(["lifecycle", "lockdown"], "lockdown supports only `{ ssh: off }`");
        else if (!session.timeLimitMinutes) err(["lifecycle", "lockdown"], "a lockdown needs session.timeLimitMinutes, so SSH is restored on time even if a session is abandoned");
        else lifecycle.lockdown = { ssh: "off" };
      }
    }
  }

  // ── collect ────────────────────────────────────────────────────────────────
  const collect: CollectStep[] = [];
  const items = new Map<string, GatherItem>();
  if (!Array.isArray(root.collect) || !root.collect.length) err(["collect"], "collect must be a list of steps, each `{ on: <role>, gather: { name: { … } } }`");
  else root.collect.forEach((rawStep, si) => {
    const p = ["collect", si];
    if (!isObj(rawStep)) { err(p, "a step must be a mapping with on and gather"); return; }
    unknownKeys(rawStep, ["on", "when", "gather"], p);
    const on = rawStep.on;
    if (typeof on !== "string" || !roles.has(on)) err([...p, "on"], `on must be one of the roles: ${[...roles].join(", ") || "(none declared)"}`);
    const when = rawStep.when ?? "always";
    if (!["always", "final", "practice"].includes(when as string)) err([...p, "when"], "when must be always, final or practice");
    if (!isObj(rawStep.gather) || !Object.keys(rawStep.gather).length) { err([...p, "gather"], "gather must name at least one item"); return; }
    const gather: GatherEntry[] = [];
    for (const [name, raw] of Object.entries(rawStep.gather)) {
      const ip = [...p, "gather", name];
      if (!NAME.test(name) || RESERVED_NAMES.has(name)) { err(ip, `"${name}" can't be used as a name (lowercase letters, digits, _; not a reserved word)`); continue; }
      if (items.has(name)) { err(ip, `"${name}" is gathered twice — names are global within a lab`); continue; }
      if (!isObj(raw)) { err(ip, `an item must be a mapping like { file: /etc/… } or { run: [cmd, arg] }`); continue; }
      const kinds = PRIMITIVES.filter((k) => k in raw);
      if (kinds.length !== 1) { err(ip, `an item needs exactly one of: ${PRIMITIVES.join(", ")}`); continue; }
      const kind = kinds[0];
      unknownKeys(raw, [kind, ...ITEM_OPTIONS[kind]], ip);
      const intOpt = (key: string, min: number, max: number) => {
        const v = raw[key];
        if (v === undefined) return undefined;
        if (!isInt(v) || v < min || v > max) { err([...ip, key], `${key} must be a whole number ${min}–${max}`); return undefined; }
        return v;
      };
      let item: GatherItem | null = null;
      switch (kind) {
        case "file": {
          const path = absPath(raw.file, [...ip, "file"], "file");
          if (path) item = { kind, path, maxBytes: intOpt("max_bytes", 1, 1 << 20) };
          break;
        }
        case "glob": {
          const pattern = absPath(raw.glob, [...ip, "glob"], "glob");
          if (raw.content !== undefined && typeof raw.content !== "boolean") err([...ip, "content"], "content must be true or false");
          if (pattern) item = { kind, pattern, content: raw.content === true, maxFiles: intOpt("max_files", 1, 500) };
          break;
        }
        case "run": {
          const argv = raw.run;
          if (typeof argv === "string") { err([...ip, "run"], "run must be a list like [nginx, -T] — commands never go through a shell"); break; }
          if (!Array.isArray(argv) || !argv.length || !argv.every((a) => typeof a === "string" || typeof a === "number")) { err([...ip, "run"], "run must be a non-empty list of arguments"); break; }
          const args = argv.map(String);
          args.forEach((a, i) => checkTemplates(a, [...ip, "run", i]));
          if (raw.stdin !== undefined && typeof raw.stdin !== "string") err([...ip, "stdin"], "stdin must be text");
          if (raw.cwd !== undefined) absPath(raw.cwd, [...ip, "cwd"], "cwd");
          if (typeof raw.stdin === "string") checkTemplates(raw.stdin, [...ip, "stdin"]);
          item = { kind, argv: args, timeout: intOpt("timeout", 1, 120), stdin: raw.stdin as string | undefined, cwd: raw.cwd as string | undefined };
          break;
        }
        case "service":
          if (typeof raw.service !== "string" || !/^[\w@.:-]+$/.test(raw.service)) err([...ip, "service"], "service must be a systemd unit name, e.g. nginx.service");
          else item = { kind, unit: raw.service };
          break;
        case "package": {
          const names = typeof raw.package === "string" ? [raw.package] : raw.package;
          if (!Array.isArray(names) || !names.length || !names.every((n) => typeof n === "string" && /^[a-z0-9][a-z0-9+.-]*$/.test(n))) err([...ip, "package"], "package must be a package name or a list of them");
          else item = { kind, names: names as string[] };
          break;
        }
        case "log": {
          const path = absPath(raw.log, [...ip, "log"], "log");
          if (path) item = { kind, path };
          break;
        }
      }
      if (item) {
        // Drop undefined optionals so the stored JSON stays tidy.
        const tidy = Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined)) as GatherItem;
        gather.push({ name, item: tidy });
        item = tidy;
        items.set(name, item);
      }
    }
    if (typeof on === "string" && roles.has(on)) collect.push({ on, when: when as CollectStep["when"], gather });
  });

  // ── parse ──────────────────────────────────────────────────────────────────
  const parse: Record<string, ParseSpec> = {};
  if (root.parse !== undefined && !isObj(root.parse)) err(["parse"], "parse must be a mapping of name → { from, with }");
  for (const [name, raw] of Object.entries(isObj(root.parse) ? root.parse : {})) {
    const p = ["parse", name];
    if (!NAME.test(name) || RESERVED_NAMES.has(name)) { err(p, `"${name}" can't be used as a name`); continue; }
    if (items.has(name)) { err(p, `"${name}" is already a gathered item`); continue; }
    if (!isObj(raw)) { err(p, "must be { from: <item>.<field>, with: <parser> }"); continue; }
    const from = typeof raw.from === "string" ? raw.from : "";
    const dot = from.indexOf(".");
    const itemName = dot === -1 ? from : from.slice(0, dot);
    const field = dot === -1 ? "" : from.slice(dot + 1);
    const item = items.get(itemName);
    if (!item) { err([...p, "from"], `from must be <item>.<field> with a gathered item (got "${from}")`); continue; }
    const fields = TEXT_FIELDS[item.kind] ?? [];
    if (!fields.includes(field)) {
      err([...p, "from"], fields.length ? `${itemName} is a ${item.kind} item: parse ${fields.map((f) => `${itemName}.${f}`).join(" or ")}` : `${itemName} is a ${item.kind} item and has no text to parse`);
      continue;
    }
    const parser = PARSERS[raw.with as string];
    if (!parser) { err([...p, "with"], `unknown parser "${raw.with}" (available: ${Object.keys(PARSERS).join(", ")})`); continue; }
    const options = Object.fromEntries(Object.entries(raw).filter(([k]) => k !== "from" && k !== "with"));
    for (const k of Object.keys(options)) if (!parser.options.includes(k)) err([...p, k], `${parser.name} has no option "${k}"${parser.options.length ? ` (options: ${parser.options.join(", ")})` : ""}`);
    const bad = parser.validate?.(options);
    if (bad) err(p, `${parser.name}: ${bad}`);
    parse[name] = { item: itemName, field, parser: parser.name, options };
  }

  // ── checks ─────────────────────────────────────────────────────────────────
  const known = new Set([...items.keys(), ...Object.keys(parse)]);
  const env = makeEnv(known);
  const used = new Set<string>(Object.values(parse).map((s) => s.item));
  const checks: Check[] = [];
  const ids = new Set<string>();
  const expr = (v: unknown, path: (string | number)[]): string | null => {
    if (typeof v !== "string" || !v.trim()) { err(path, "must be a CEL expression"); return null; }
    const problem = checkExpression(env, v);
    if (problem) { err(path, problem); return null; }
    referencedNames(v, known).forEach((n) => used.add(n));
    return v.trim();
  };
  if (!Array.isArray(root.checks) || !root.checks.length) err(["checks"], "checks must be a non-empty list");
  else root.checks.forEach((raw, ci) => {
    const p = ["checks", ci];
    if (!isObj(raw)) { err(p, "a check must be a mapping with id, title and assert"); return; }
    unknownKeys(raw, ["id", "title", "points", "assert", "hint", "when", "flag", "visibility"], p);
    const id = raw.id;
    if (typeof id !== "string" || !NAME.test(id)) { err([...p, "id"], "id must be lowercase letters, digits or _"); return; }
    if (ids.has(id)) err([...p, "id"], `duplicate check id "${id}"`);
    ids.add(id);
    if (typeof raw.title !== "string" || !raw.title.trim()) err([...p, "title"], "title is required");
    if (raw.hint !== undefined && typeof raw.hint !== "string") err([...p, "hint"], "hint must be text");
    if (typeof raw.hint === "string" && raw.hint.includes("{{")) err([...p, "hint"], "hints can't contain {{…}}: they must not reveal per-student values");
    const visibility = raw.visibility ?? "student";
    if (visibility !== "student" && visibility !== "instructor") err([...p, "visibility"], "visibility must be student or instructor");
    const flag = raw.flag ?? null;
    if (flag !== null && (typeof flag !== "string" || !FLAG.test(flag))) err([...p, "flag"], "flag must be an UPPER_SNAKE_CASE code");
    const when = raw.when === undefined ? null : expr(raw.when, [...p, "when"]);

    const a = raw.assert;
    const assertions: Assertion[] = [];
    let mode: Check["mode"] = "all";
    if (typeof a === "string") {
      const e = expr(a, [...p, "assert"]);
      if (e) assertions.push({ expr: e, points: 0, label: String(raw.title ?? id) });
    } else if (Array.isArray(a) && a.length && a.every((x) => typeof x === "string")) {
      a.forEach((x, i) => { const e = expr(x, [...p, "assert", i]); if (e) assertions.push({ expr: e, points: 0, label: e }); });
    } else if (Array.isArray(a) && a.length && a.every(isObj)) {
      mode = "partial";
      a.forEach((x, i) => {
        const ap = [...p, "assert", i];
        unknownKeys(x as Obj, ["expr", "points", "label"], ap);
        const e = expr((x as Obj).expr, [...ap, "expr"]);
        const pts = (x as Obj).points;
        if (!isInt(pts) || pts < 1 || pts > 1000) err([...ap, "points"], "points must be a whole number 1–1000");
        if (e && isInt(pts)) assertions.push({ expr: e, points: pts, label: typeof (x as Obj).label === "string" ? ((x as Obj).label as string) : e });
      });
    } else {
      err([...p, "assert"], "assert must be an expression, a list of expressions, or a list of { expr, points, label }");
    }

    let points = 0;
    if (flag !== null) {
      if (raw.points !== undefined) err([...p, "points"], "a flag check scores nothing — remove points");
      if (mode === "partial") err([...p, "assert"], "a flag check can't have per-assertion points");
    } else if (mode === "partial") {
      points = assertions.reduce((n, x) => n + x.points, 0);
      if (raw.points !== undefined && raw.points !== points) err([...p, "points"], `points (${raw.points}) must equal the sum of the assertion points (${points}) or be left out`);
    } else if (!isInt(raw.points) || raw.points < 1 || raw.points > 1000) {
      err([...p, "points"], "points must be a whole number 1–1000 (or give each assertion its own points)");
    } else points = raw.points;

    checks.push({
      id, title: String(raw.title ?? id).trim(), visibility: visibility as Check["visibility"], hint: typeof raw.hint === "string" ? raw.hint.trim() : null,
      when, flag: flag as string | null, mode, points, assertions,
    });
  });

  for (const name of items.keys()) if (!used.has(name)) warn(["collect"], `"${name}" is gathered but no check or parse uses it`);
  const maxScore = checks.reduce((n, c) => n + (c.flag ? 0 : c.points), 0);
  if (Array.isArray(root.checks) && root.checks.length && maxScore <= 0 && !errors.length) err(["checks"], "no check scores any points");
  if (opts.assets) for (const a of opts.assets) if (!usedAssets.has(a)) warn(["collect"], `lab/assets file "${a}" is never used`);

  if (errors.length) return { ok: false, errors, warnings };

  const capabilities = new Set<string>(["baseline"]);
  for (const step of collect) for (const { item } of step.gather) capabilities.add(item.kind);
  if (lifecycle.lockdown) capabilities.add("ssh_lockdown");

  const lab: CompiledLab = {
    zcl: ZCL_VERSION, session, machines, params, lifecycle, collect, parse, checks,
    assets: [...usedAssets].sort(), capabilities: [...capabilities].sort(), maxScore,
  };
  return { ok: true, lab, warnings };
}
