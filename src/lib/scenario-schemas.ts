/**
 * Validators for the JSON bundles instructors provide when authoring a
 * scenario. These are intentionally lightweight (no external schema lib): they
 * parse + shape-check and return a helpful message on failure. The canonical
 * documentation lives in docs/scenario-schemas.md.
 */
export type Validated<T> = { ok: true; data: T } | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Parse a JSON string, returning a friendly error if it's malformed. */
export function parseJson(text: string): Validated<unknown> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "No JSON provided." };
  try {
    return { ok: true, data: JSON.parse(trimmed) };
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : "parse error"}` };
  }
}

const isStr = (v: unknown) => typeof v === "string" && v.length > 0;

// ── Logs ────────────────────────────────────────────────────────────────────
export function validateLogs(raw: unknown): Validated<{ version: number; entries: unknown[] }> {
  if (!isObject(raw)) return { ok: false, error: "Logs must be an object with an `entries` array." };
  const entries = raw.entries;
  if (!Array.isArray(entries)) return { ok: false, error: "`entries` must be an array." };
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!isObject(e)) return { ok: false, error: `entries[${i}] must be an object.` };
    for (const f of ["ts", "host", "source", "action", "message"]) {
      if (!isStr(e[f])) return { ok: false, error: `entries[${i}].${f} is required (string).` };
    }
  }
  return { ok: true, data: { version: Number(raw.version) || 1, entries } };
}

// ── Alerts ──────────────────────────────────────────────────────────────────
export function validateAlerts(raw: unknown): Validated<{ version: number; alerts: unknown[] }> {
  if (!isObject(raw)) return { ok: false, error: "Alerts must be an object with an `alerts` array." };
  const alerts = raw.alerts;
  if (!Array.isArray(alerts)) return { ok: false, error: "`alerts` must be an array." };
  for (let i = 0; i < alerts.length; i++) {
    const a = alerts[i];
    if (!isObject(a)) return { ok: false, error: `alerts[${i}] must be an object.` };
    if (!isStr(a.id)) return { ok: false, error: `alerts[${i}].id is required.` };
    if (!isStr(a.title)) return { ok: false, error: `alerts[${i}].title is required.` };
    if (!isStr(a.host)) return { ok: false, error: `alerts[${i}].host is required.` };
    if (!Number.isInteger(a.seek) || (a.seek as number) < 0) {
      return { ok: false, error: `alerts[${i}].seek must be an integer >= 0 (seconds from start).` };
    }
  }
  return { ok: true, data: { version: Number(raw.version) || 1, alerts } };
}

// ── EDR ─────────────────────────────────────────────────────────────────────
function validateProcessTree(nodes: unknown, path: string): string | null {
  if (!Array.isArray(nodes)) return `${path} must be an array.`;
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    if (!isObject(p)) return `${path}[${i}] must be an object.`;
    if (typeof p.pid !== "number") return `${path}[${i}].pid must be a number.`;
    if (!isStr(p.name)) return `${path}[${i}].name is required.`;
    if (p.children !== undefined) {
      const err = validateProcessTree(p.children, `${path}[${i}].children`);
      if (err) return err;
    }
  }
  return null;
}

export function validateEdr(raw: unknown): Validated<Record<string, unknown>> {
  if (!isObject(raw)) return { ok: false, error: "EDR sample must be an object." };
  if (!isStr(raw.hostname)) return { ok: false, error: "`hostname` is required." };
  const sections = ["processes", "connections", "browserHistory", "shellHistory"] as const;
  if (!sections.some((s) => Array.isArray(raw[s]))) {
    return { ok: false, error: "Provide at least one of: processes, connections, browserHistory, shellHistory." };
  }
  if (raw.processes !== undefined) {
    const err = validateProcessTree(raw.processes, "processes");
    if (err) return { ok: false, error: err };
  }
  for (const s of ["connections", "browserHistory", "shellHistory"] as const) {
    if (raw[s] !== undefined && !Array.isArray(raw[s])) {
      return { ok: false, error: `${s} must be an array.` };
    }
  }
  return { ok: true, data: raw };
}

// ── OSQuery ─────────────────────────────────────────────────────────────────
export function validateOsquery(raw: unknown): Validated<Record<string, unknown>> {
  if (!isObject(raw)) return { ok: false, error: "OSQuery data must be an object." };
  if (!isStr(raw.hostname)) return { ok: false, error: "`hostname` is required." };
  if (!isObject(raw.tables)) return { ok: false, error: "`tables` must be an object of table-name -> rows[]." };
  for (const [name, rows] of Object.entries(raw.tables)) {
    if (!Array.isArray(rows)) return { ok: false, error: `tables.${name} must be an array of rows.` };
  }
  return { ok: true, data: raw };
}

// ── Objectives & flags (authored in the UI, not uploaded) ────────────────────
export type Objective = { id: string; text: string };
export type Flag = { id: string; question: string; answer: string; points: number };

export function normalizeObjectives(items: { text: string }[]): Objective[] {
  return items
    .map((o) => o.text.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `o${i + 1}`, text }));
}

export function normalizeFlags(items: { question: string; answer: string; points?: number }[]): Flag[] {
  return items
    .filter((f) => f.question.trim() && f.answer.trim())
    .map((f, i) => ({
      id: `f${i + 1}`,
      question: f.question.trim(),
      answer: f.answer.trim(),
      points: Number(f.points) || 0,
    }));
}
