import { randomInt } from "node:crypto";
import type { ParamSpec } from "./types";

/**
 * Per-student parameter values (docs/labs/spec.md 9.2). Values are drawn once
 * and stored (LabParam); `unique: cohort` params are re-drawn until no one
 * else in the student's cohort has the same value.
 */

export type ParamValues = Record<string, string | number>;

const ALPHABETS = {
  // RFC 4648 base32 minus the look-alikes students mistype (0/O, 1/I/L).
  base32: "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
  hex: "0123456789abcdef",
  alnum: "abcdefghijklmnopqrstuvwxyz0123456789",
} as const;

export function drawParam(spec: ParamSpec, rand: (n: number) => number = randomInt): string | number {
  switch (spec.type) {
    case "token": {
      const a = ALPHABETS[spec.alphabet];
      return Array.from({ length: spec.length }, () => a[rand(a.length)]).join("");
    }
    case "int":
      return spec.min + rand(Math.floor((spec.max - spec.min) / spec.step) + 1) * spec.step;
    case "choice":
      return spec.values[rand(spec.values.length)];
  }
}

/**
 * Draw a value for every parameter. `taken[name]` holds values others in the
 * cohort already have; unique params avoid them (up to 200 tries, then the
 * least-used fallback is accepted rather than failing a student).
 */
export function drawParams(
  specs: Record<string, ParamSpec>,
  taken: Record<string, Set<string>> = {},
  rand: (n: number) => number = randomInt,
): ParamValues {
  const out: ParamValues = {};
  for (const [name, spec] of Object.entries(specs)) {
    let v = drawParam(spec, rand);
    if (spec.unique) {
      const used = taken[name] ?? new Set<string>();
      for (let i = 0; i < 200 && used.has(String(v)); i++) v = drawParam(spec, rand);
    }
    out[name] = v;
  }
  return out;
}

/** Check stored/declared values against the specs (used for reference evidence). */
export function validateParamValues(specs: Record<string, ParamSpec>, values: unknown): string | null {
  if (typeof values !== "object" || values === null || Array.isArray(values)) return "params must be an object of name → value";
  const v = values as Record<string, unknown>;
  for (const [name, spec] of Object.entries(specs)) {
    const x = v[name];
    if (x === undefined) return `missing value for param "${name}"`;
    if (spec.type === "token") {
      if (typeof x !== "string" || x.length !== spec.length || [...x].some((c) => !ALPHABETS[spec.alphabet].includes(c))) {
        return `param "${name}" must be a ${spec.length}-character ${spec.alphabet} token`;
      }
    } else if (spec.type === "int") {
      if (typeof x !== "number" || !Number.isInteger(x) || x < spec.min || x > spec.max || (x - spec.min) % spec.step !== 0) {
        return `param "${name}" must be a whole number in ${spec.min}–${spec.max} (step ${spec.step})`;
      }
    } else if (!spec.values.some((c) => String(c) === String(x))) {
      return `param "${name}" must be one of: ${spec.values.join(", ")}`;
    }
  }
  return null;
}
