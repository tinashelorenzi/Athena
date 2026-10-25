import type { ParamValues } from "./params";
import type { CompiledLab } from "./types";

/**
 * Evidence: what the agents report for one check run, keyed by role
 * (protocol/schema/evidence.schema.json). Each gathered item is either
 * `{ ok: true, …fields }` or `{ ok: false, error, message }`.
 *
 * Reference evidence files (lab/reference/*.evidence.json) use the same shape
 * plus `params`: the parameter values the reference machine was built with.
 */

export type ItemResult = { ok: boolean; error?: string; message?: string; [field: string]: unknown };

export type RoleEvidence = {
  machine?: { hostname?: string; osVersion?: string };
  items: Record<string, ItemResult>;
  /** From the session baseline: path → sha256 at session start. */
  baseline?: { files?: Record<string, string> };
  /** Lockdown labs: the agent's report on whether SSH stayed off (spec 13). */
  lockdown?: LockdownStatus;
};

export type LockdownStatus = {
  units?: { unit: string; loadState: string; activeState: string; unitFileState: string }[];
  /** The agent still holds the session's undo journal. */
  journal?: boolean;
  /** Live SSH login sessions at collection time. */
  sshSessions?: number;
  /** auth.log lines for SSH logins since the baseline. */
  logins?: string[];
};

/** Instructor flags from lockdown reports: SSH used, or the lockdown undone by hand. */
export function lockdownFlags(evidence: Evidence): string[] {
  const flags = new Set<string>();
  for (const role of Object.values(evidence.roles ?? {})) {
    const l = role.lockdown;
    if (!l) continue;
    if ((l.logins?.length ?? 0) > 0 || (l.sshSessions ?? 0) > 0) flags.add("SSH_DURING_LOCKDOWN");
    if (l.journal === false || (l.units ?? []).some((u) => u.activeState === "active" || u.loadState !== "masked")) flags.add("LOCKDOWN_TAMPERED");
  }
  return [...flags];
}

export type Evidence = { format: 1; params?: ParamValues; roles: Record<string, RoleEvidence> };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Shape check; returns problems (empty = fine). Missing items are allowed — they grade as "not collected". */
export function validateEvidence(raw: unknown, lab: CompiledLab): string[] {
  const problems: string[] = [];
  if (!isObj(raw)) return ["evidence must be a JSON object"];
  if (raw.format !== 1) problems.push("format must be 1");
  if (!isObj(raw.roles)) return [...problems, "roles must be an object of role → { items }"];
  for (const role of Object.keys(lab.machines)) {
    const r = raw.roles[role];
    if (!isObj(r)) { problems.push(`roles.${role} is missing`); continue; }
    if (!isObj(r.items)) { problems.push(`roles.${role}.items must be an object`); continue; }
    for (const [name, item] of Object.entries(r.items)) {
      if (!isObj(item) || typeof item.ok !== "boolean") problems.push(`roles.${role}.items.${name} must be { ok: true|false, … }`);
    }
  }
  for (const role of Object.keys(raw.roles)) if (!lab.machines[role]) problems.push(`roles.${role}: the lab has no such role`);
  return problems;
}

/** Add baseline comparisons to a file result (and each file of a glob result). */
export function withBaseline(result: ItemResult, baseline: Record<string, string> | undefined, fallbackPath?: string): ItemResult {
  if (!result.ok) return result;
  const one = (f: Record<string, unknown>, path?: string): Record<string, unknown> => {
    const p = typeof f.path === "string" ? f.path : path;
    const before = p && baseline ? baseline[p] : undefined;
    const exists = f.exists !== false;
    return {
      ...f,
      existed_at_start: before !== undefined,
      baseline_sha256: before ?? null,
      // Without a baseline nothing can be compared: treat existing files as changed.
      changed: baseline ? (before === undefined ? exists : before !== f.sha256) : exists,
    };
  };
  if (Array.isArray(result.files)) return { ...result, files: result.files.map((f) => (isObj(f) ? one(f) : f)) };
  return one(result, fallbackPath) as ItemResult; // spreads `result`, so `ok` is kept
}
