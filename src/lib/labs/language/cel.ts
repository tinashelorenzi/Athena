import { createHash } from "node:crypto";
import { Environment } from "@marcbachmann/cel-js";

/**
 * CEL environment for lab assertions (docs/labs/spec.md 9.7). CEL always
 * terminates and has no side effects, so authors can't hang or break grading.
 */

export const CEL_FUNCTIONS = ["cidrContains", "semverGte", "lines", "count", "sha256"] as const;

/** Names a gather/parse/param entry may not take. */
export const RESERVED_NAMES = new Set<string>([
  "param", "session", "machine", "true", "false", "null", "in", "as", "break", "const", "continue", "else", "for",
  "function", "if", "import", "let", "loop", "package", "namespace", "return", "var", "void", "while",
  "has", "size", "int", "uint", "double", "string", "bytes", "bool", "list", "map", "type", "dyn", "null_type",
  "matches", "exists", "all", "filter", "exists_one", "duration", "timestamp", "optional",
  ...CEL_FUNCTIONS,
]);

function ipv4(s: string): number | null {
  const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/** IPv4 only for now: cidrContains("10.50.0.0/16", "10.50.37.4"). Malformed input → false. */
export function cidrContains(cidr: string, ip: string): boolean {
  const [net, bitsRaw] = cidr.split("/");
  const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
  const a = ipv4(net);
  const b = ipv4(ip);
  if (a === null || b === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((a & mask) >>> 0) === ((b & mask) >>> 0);
}

/** Numeric dotted comparison, ignoring a leading "v" and anything after the numbers ("1.24.0-2ubuntu7"). */
export function semverGte(a: string, b: string): boolean {
  const nums = (s: string) => (s.trim().replace(/^v/i, "").match(/^\d+(\.\d+)*/)?.[0] ?? "0").split(".").map(Number);
  const x = nums(a);
  const y = nums(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

export function makeEnv(variables: Iterable<string>): Environment {
  const env = new Environment({ unlistedVariablesAreDyn: false, homogeneousAggregateLiterals: false })
    .registerFunction("cidrContains(string, string): bool", cidrContains)
    .registerFunction("semverGte(string, string): bool", semverGte)
    .registerFunction("lines(string): list<string>", (s: string) => s.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== ""))
    .registerFunction("count(string, string): int", (s: string, sub: string) => BigInt(sub ? s.split(sub).length - 1 : 0))
    .registerFunction("sha256(string): string", (s: string) => createHash("sha256").update(s).digest("hex"));
  for (const v of new Set(["param", "session", "machine", ...variables])) env.registerVariable(v, "dyn");
  return env;
}

/** Compile-time check: parses, resolves names, and requires a true/false result. */
export function checkExpression(env: Environment, expr: string): string | null {
  try {
    const res = env.check(expr) as { valid: boolean; type?: string; error?: { message?: string } };
    if (!res.valid) return firstLine(res.error?.message ?? "invalid expression");
    if (res.type && res.type !== "bool" && res.type !== "dyn") return `must evaluate to true/false, not ${res.type}`;
    return null;
  } catch (e) {
    return firstLine(e instanceof Error ? e.message : String(e));
  }
}

const firstLine = (s: string) => s.split("\n")[0];

/**
 * JSON → CEL values: whole numbers become CEL ints (BigInt) so arithmetic like
 * `param.sid_base + 10000` type-checks; other numbers stay doubles.
 */
export function toCel(v: unknown): unknown {
  if (typeof v === "number") return Number.isInteger(v) ? BigInt(v) : v;
  if (Array.isArray(v)) return v.map(toCel);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toCel(x)]));
  return v;
}

/** Top-level identifiers an expression uses, ignoring string literals and field names after ".". */
export function referencedNames(expr: string, known: Set<string>): string[] {
  const noStrings = expr.replace(/(?:[rR])?("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, '""');
  const out = new Set<string>();
  for (const m of noStrings.matchAll(/(^|[^.\w])([A-Za-z_]\w*)/g)) if (known.has(m[2])) out.add(m[2]);
  return [...out];
}
