import { makeEnv, referencedNames, toCel } from "./cel";
import { withBaseline, type Evidence, type ItemResult } from "./evidence";
import { PARSERS, parserRevision } from "./parsers";
import type { ParamValues } from "./params";
import type { CompiledLab, Check } from "./types";

/**
 * Grading is a pure function of (compiled lab, evidence, params): the same
 * inputs always give the same result, so any session can be re-graded after a
 * parser or check fix (docs/labs/spec.md section 12).
 */

export type AssertionResult = { label: string; passed: boolean; points: number; max: number; reason: string | null };

export type CheckResult = {
  id: string;
  title: string;
  visibility: Check["visibility"];
  /** Skipped: its `when` was false. Not scored, not counted in the maximum. */
  skipped: boolean;
  passed: boolean;
  points: number;
  max: number;
  flag: string | null;
  /** Flag checks: the flag was raised. */
  flagged: boolean;
  hint: string | null;
  /** Student-safe reason a check failed because something couldn't be evaluated. */
  reason: string | null;
  assertions: AssertionResult[];
  /** Instructor-only diagnostics (evaluation errors). */
  detail: string[];
};

export type GradeResult = {
  score: number;
  maxScore: number;
  checks: CheckResult[];
  flags: string[];
  graderRev: string;
  /** Parsed values, for the check editor. */
  parsed: Record<string, unknown>;
};

export type GradeContext = {
  params: ParamValues;
  session?: { nonce?: string; id?: string; startedAt?: string };
  /** Run kind; steps with `when: final|practice` only count on matching runs. */
  run?: "final" | "practice";
};

const NOT_COLLECTED: ItemResult = { ok: false, error: "missing", message: "not collected" };

export function gradeLab(lab: CompiledLab, evidence: Evidence, ctx: GradeContext): GradeResult {
  const run = ctx.run ?? "final";
  const values: Record<string, unknown> = {};
  /** name → student-safe reason it can't be used. */
  const broken = new Map<string, string>();

  // 1. Gathered items, with baseline comparisons for file/glob results.
  for (const step of lab.collect) {
    const active = step.when === "always" || step.when === run;
    const role = evidence.roles?.[step.on];
    for (const { name, item } of step.gather) {
      let res: ItemResult = (active && role?.items?.[name]) || NOT_COLLECTED;
      if (item.kind === "file" || item.kind === "glob") res = withBaseline(res, role?.baseline?.files, item.kind === "file" ? item.path : undefined);
      values[name] = res;
      if (!res.ok) broken.set(name, `${name}: ${res.message || res.error || "failed"}`);
    }
  }

  // 2. Parse steps.
  const parsed: Record<string, unknown> = {};
  for (const [name, spec] of Object.entries(lab.parse)) {
    const src = values[spec.item] as ItemResult;
    if (broken.has(spec.item)) {
      broken.set(name, broken.get(spec.item)!);
      values[name] = null;
      continue;
    }
    const text = src[spec.field];
    if (typeof text !== "string") {
      broken.set(name, `${spec.item}: no ${spec.field} to read`);
      values[name] = null;
      continue;
    }
    try {
      values[name] = parsed[name] = PARSERS[spec.parser].parse(text, spec.options);
    } catch (e) {
      broken.set(name, `${spec.item}: could not be read as ${spec.parser} (${e instanceof Error ? e.message : e})`);
      values[name] = null;
    }
  }

  const known = new Set(Object.keys(values));
  const env = makeEnv(known);
  const context = toCel({ ...values, param: ctx.params, session: ctx.session ?? {}, machine: machineContext(evidence) }) as Record<string, unknown>;

  const evaluate = (expr: string): { value: boolean | null; reason: string | null; detail: string | null } => {
    const blocked = referencedNames(expr, known).find((n) => broken.has(n));
    if (blocked) return { value: null, reason: broken.get(blocked)!, detail: null };
    try {
      const v = env.evaluate(expr, context);
      if (typeof v !== "boolean") return { value: false, reason: "check could not be evaluated", detail: `${expr} returned ${typeof v}, not true/false` };
      return { value: v, reason: null, detail: null };
    } catch (e) {
      // Most runtime errors mean "the thing isn't there" (missing key, empty list).
      return { value: false, reason: null, detail: `${expr}: ${e instanceof Error ? e.message.split("\n")[0] : e}` };
    }
  };

  // 3. Checks.
  const checks: CheckResult[] = [];
  const flags: string[] = [];
  for (const check of lab.checks) {
    const res: CheckResult = {
      id: check.id, title: check.title, visibility: check.visibility, skipped: false, passed: false, points: 0,
      max: check.flag ? 0 : check.points, flag: check.flag, flagged: false, hint: null, reason: null, assertions: [], detail: [],
    };
    if (check.when) {
      const w = evaluate(check.when);
      if (w.detail) res.detail.push(w.detail);
      if (w.value !== true) {
        res.skipped = true;
        res.max = 0;
        checks.push(res);
        continue;
      }
    }
    for (const a of check.assertions) {
      const r = evaluate(a.expr);
      if (r.detail) res.detail.push(r.detail);
      const passed = r.value === true;
      const max = check.mode === "partial" ? a.points : 0;
      res.assertions.push({ label: a.label, passed, points: passed ? max : 0, max, reason: r.reason });
    }
    res.passed = res.assertions.every((a) => a.passed);
    res.reason = res.assertions.find((a) => a.reason)?.reason ?? null;
    if (check.flag) {
      // Raise only on a real "false": a check that couldn't be evaluated proves nothing.
      res.flagged = res.assertions.some((a) => !a.passed && !a.reason);
      if (res.flagged) flags.push(check.flag);
    } else {
      res.points = check.mode === "partial" ? res.assertions.reduce((n, a) => n + a.points, 0) : res.passed ? check.points : 0;
    }
    if (!res.passed && !check.flag) res.hint = check.hint;
    checks.push(res);
  }

  const parsersUsed = [...new Set(Object.values(lab.parse).map((p) => p.parser))];
  return {
    score: checks.reduce((n, c) => n + c.points, 0),
    maxScore: checks.reduce((n, c) => n + c.max, 0),
    checks,
    flags: [...new Set(flags)],
    graderRev: `zcl${lab.zcl};${parserRevision(parsersUsed)}`,
    parsed,
  };
}

function machineContext(evidence: Evidence): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(evidence.roles ?? {}).map(([role, r]) => [role, { hostname: r.machine?.hostname ?? "", osVersion: r.machine?.osVersion ?? "" }]),
  );
}
