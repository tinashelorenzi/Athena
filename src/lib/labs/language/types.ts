/**
 * Compiled form of a lab definition (lab/lab.yaml, docs/labs/spec.md section 9).
 * The compiler turns YAML into a CompiledLab; it is stored as
 * LabVersion.definition and is the only input the grader needs besides evidence.
 */

export const ZCL_VERSION = 1;

export type ShowResults = "dojo" | "always" | "never";

export type SessionPolicy = {
  timeLimitMinutes: number | null;
  checks: { practice: boolean; maxPractice: number; cooldownSeconds: number; showResults: ShowResults };
};

export type MachineRole = { os: string; versions: string[]; packages: string[] };

export type ParamSpec =
  | { type: "token"; length: number; alphabet: "base32" | "hex" | "alnum"; unique: boolean }
  | { type: "int"; min: number; max: number; step: number; unique: boolean }
  | { type: "choice"; values: (string | number)[]; unique: boolean };

export type Lifecycle = {
  /** Per role: file globs hashed at session start, logs whose offsets are recorded. */
  baseline: Record<string, { hash: string[]; logs: string[] }>;
  lockdown: { ssh: "off" } | null;
};

/** One thing the agent gathers. Exactly one primitive per item. */
export type GatherItem =
  | { kind: "file"; path: string; maxBytes?: number }
  | { kind: "glob"; pattern: string; content: boolean; maxFiles?: number }
  | { kind: "run"; argv: string[]; timeout?: number; stdin?: string; cwd?: string }
  | { kind: "service"; unit: string }
  | { kind: "package"; names: string[] }
  | { kind: "log"; path: string };

/** A gathered item with its name. Kept as an ordered list: stored definitions
 *  live in Postgres jsonb, which re-sorts object keys, and order matters here. */
export type GatherEntry = { name: string; item: GatherItem };

export type CollectStep = {
  on: string;
  when: "always" | "final" | "practice";
  gather: GatherEntry[];
};

export type ParseSpec = {
  /** Gather item name the text comes from. */
  item: string;
  /** Field of that item's result holding the text, e.g. "stdout" or "content". */
  field: string;
  parser: string;
  options: Record<string, unknown>;
};

export type Assertion = { expr: string; points: number; label: string };

export type Check = {
  id: string;
  title: string;
  visibility: "student" | "instructor";
  hint: string | null;
  /** CEL: the check is skipped (not scored) unless this is true. */
  when: string | null;
  /** Flag-only check: raises `flag` when the assertion is false; scores nothing. */
  flag: string | null;
  /** all-or-nothing: one assertion list worth `points`; partial: each assertion has its own points. */
  mode: "all" | "partial";
  points: number;
  assertions: Assertion[];
};

export type CompiledLab = {
  zcl: number;
  session: SessionPolicy;
  machines: Record<string, MachineRole>;
  params: Record<string, ParamSpec>;
  lifecycle: Lifecycle;
  collect: CollectStep[];
  parse: Record<string, ParseSpec>;
  checks: Check[];
  /** Asset names referenced as {{asset.x}} (files come from lab/assets/). */
  assets: string[];
  /** Agent capabilities a machine needs to run this lab. */
  capabilities: string[];
  maxScore: number;
};

export type CompileIssue = { path: string; message: string; line?: number };

export type CompileResult =
  | { ok: true; lab: CompiledLab; warnings: CompileIssue[] }
  | { ok: false; errors: CompileIssue[]; warnings: CompileIssue[] };
