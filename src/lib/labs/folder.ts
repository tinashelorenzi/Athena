import { createHash } from "node:crypto";
import { assetName, compileLab } from "./language/compile";
import { validateEvidence, type Evidence } from "./language/evidence";
import { gradeLab, type GradeResult } from "./language/grade";
import { validateParamValues, type ParamValues } from "./language/params";
import { templateRefs } from "./language/template";
import type { CompiledLab } from "./language/types";
import { normalizeTechniques } from "@/lib/scenario-schemas";
import { labFileName, normalizeScript, scriptFileNames, validateLabFile, validateScript } from "./language/scripts";

/**
 * Checks a lab folder (docs/labs/spec.md sections 10–11) without touching the
 * database: manifest, brief, lab.yaml, assets, scripts (and their files), and the reference-evidence gate.
 * Used by the Autobuilder, `npm run import:scenario` and `npm run lab:check`.
 */

export type FolderFile = { rel: string; size: number; text(): Promise<string>; bytes(): Promise<Uint8Array> };

export type FolderIssue = { file: string; path?: string; line?: number; message: string };

export type LabMeta = {
  slug: string;
  title: string;
  description: string;
  type: "DOJO" | "ASSESSMENT";
  exposure: "ROLLOUT" | "PUBLIC";
  hidden: boolean;
  techniques: string[];
  brief: string;
};

export type LabAsset = { name: string; file: string; size: number; sha256: string };

/** A scripts/<name>.sh file the brief can hand out with {{script.<name>}}. */
export type LabFolderScript = { name: string; file: string; size: number; content: string };

/** A scripts/files/<filename> file that scripts download with {{file.<name>}}. */
export type LabFolderFile = { name: string; filename: string; file: string; size: number; sha256: string };

export type GateRun = {
  score: number;
  maxScore: number;
  flags: string[];
  checks: { id: string; title: string; passed: boolean; skipped: boolean; points: number; max: number; flagged: boolean; reason: string | null; detail: string[] }[];
};

export type Expectation = { check: string; expected: "pass" | "fail" | "flag"; ok: boolean };

export type LabFolderReport = {
  ok: boolean;
  /** No good reference: saved as a draft that only architects can run, to capture one. */
  draft?: boolean;
  errors: FolderIssue[];
  warnings: FolderIssue[];
  meta?: LabMeta;
  lab?: CompiledLab;
  labFile?: string;
  assets: LabAsset[];
  scripts: LabFolderScript[];
  files: LabFolderFile[];
  /** lab.yaml text and the reference evidence, kept with the version for the check editor. */
  source?: string;
  references?: { good?: Evidence; broken?: Evidence; brokenExpect?: unknown };
  gate: { good?: GateRun; broken?: GateRun & { expectations: Expectation[] }; referenceParams?: ParamValues };
};

const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function summarize(g: GradeResult): GateRun {
  return {
    score: g.score,
    maxScore: g.maxScore,
    flags: g.flags,
    checks: g.checks.map((c) => ({
      id: c.id, title: c.title, passed: c.passed, skipped: c.skipped, points: c.points, max: c.max, flagged: c.flagged, reason: c.reason, detail: c.detail,
    })),
  };
}

export async function checkLabFolder(
  files: FolderFile[],
  opts: {
    maxCohortSize?: number;
    /** Scripts the lab already has on Athena (by slug), which the brief may use without the folder shipping them. */
    existingScripts?: (slug: string) => Promise<string[]>;
    /** Likewise for lab files, which scripts may use. */
    existingFiles?: (slug: string) => Promise<string[]>;
  } = {},
): Promise<LabFolderReport> {
  const report: LabFolderReport = { ok: false, errors: [], warnings: [], assets: [], scripts: [], files: [], gate: {} };
  const err = (file: string, message: string, extra: Partial<FolderIssue> = {}) => report.errors.push({ file, message, ...extra });
  const byRel = new Map(files.map((f) => [f.rel, f]));
  const readJson = async (rel: string): Promise<unknown> => {
    const f = byRel.get(rel);
    if (!f) return undefined;
    try {
      return JSON.parse(await f.text());
    } catch (e) {
      err(rel, `not valid JSON: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  };

  // ── manifest ──────────────────────────────────────────────────────────────
  const m = await readJson("scenario.json");
  if (m === undefined) err("scenario.json", "missing: the folder needs a scenario.json at its root");
  if (!isObj(m)) return report;
  if (m.kind !== "LAB") err("scenario.json", 'kind must be "LAB" for a lab folder');
  const slug = typeof m.slug === "string" ? m.slug.trim() : "";
  if (!SLUG.test(slug)) err("scenario.json", "slug is required: lowercase letters, digits and dashes, e.g. p21-web (students type it: zaio start p21-web)");
  const title = typeof m.title === "string" ? m.title.trim() : "";
  if (!title) err("scenario.json", "title is required");
  const type = m.type === "ASSESSMENT" ? "ASSESSMENT" : "DOJO";
  if (m.type !== undefined && m.type !== "DOJO" && m.type !== "ASSESSMENT") err("scenario.json", "type must be DOJO or ASSESSMENT");

  let brief = "";
  if (typeof m.brief === "string" && m.brief) {
    if (m.brief.endsWith(".md")) {
      const f = byRel.get(m.brief);
      if (!f) err("scenario.json", `brief file "${m.brief}" not found in the folder`);
      else brief = await f.text();
    } else brief = m.brief;
  }

  // ── lab.yaml + assets ─────────────────────────────────────────────────────
  const labFile = typeof m.lab === "string" && m.lab ? m.lab : "lab/lab.yaml";
  report.labFile = labFile;
  const labSrc = byRel.get(labFile);
  if (!labSrc) {
    err("scenario.json", `lab definition "${labFile}" not found in the folder`);
    return report;
  }
  const labDir = labFile.includes("/") ? labFile.slice(0, labFile.lastIndexOf("/") + 1) : "";
  for (const f of files.filter((x) => x.rel.startsWith(`${labDir}assets/`) && x.size > 0)) {
    const name = assetName(f.rel);
    if (report.assets.some((a) => a.name === name)) {
      err(f.rel, `two assets map to the name "${name}" — rename one`);
      continue;
    }
    report.assets.push({ name, file: f.rel, size: f.size, sha256: createHash("sha256").update(await f.bytes()).digest("hex") });
  }

  const sourceText = await labSrc.text();
  report.source = sourceText;
  const compiled = compileLab(sourceText, { assets: report.assets.map((a) => a.name), maxCohortSize: opts.maxCohortSize });
  for (const w of compiled.warnings) report.warnings.push({ file: labFile, path: w.path, line: w.line, message: w.message });
  if (!compiled.ok) {
    for (const e of compiled.errors) err(labFile, e.message, { path: e.path, line: e.line });
    return report;
  }
  const lab = compiled.lab;
  report.lab = lab;
  // Only ship assets the lab actually uses.
  report.assets = report.assets.filter((a) => lab.assets.includes(a.name));

  // ── scripts/files/* (downloaded by scripts) ─────────────────────────────────
  for (const f of files.filter((x) => x.rel.startsWith("scripts/files/"))) {
    const filename = f.rel.slice("scripts/files/".length);
    if (filename.includes("/")) {
      report.warnings.push({ file: f.rel, message: "ignored: scripts/files/ holds files only (no sub-folders)" });
      continue;
    }
    const problems = validateLabFile(filename, f.size);
    problems.forEach((p) => err(f.rel, p));
    if (problems.length) continue;
    const name = labFileName(filename);
    const clash = report.files.find((x) => x.name === name);
    if (clash) {
      err(f.rel, `${clash.filename} and ${filename} both become {{file.${name}}}: rename one`);
      continue;
    }
    report.files.push({ name, filename, file: f.rel, size: f.size, sha256: createHash("sha256").update(await f.bytes()).digest("hex") });
  }
  const filesOnAthena = slug && opts.existingFiles ? await opts.existingFiles(slug) : [];
  const fileNames = [...new Set([...report.files.map((x) => x.name), ...filesOnAthena])];

  // ── scripts/*.sh ──────────────────────────────────────────────────────────
  for (const f of files.filter((x) => x.rel.startsWith("scripts/") && !x.rel.startsWith("scripts/files/"))) {
    const base = f.rel.slice("scripts/".length);
    if (base.includes("/") || !base.endsWith(".sh")) {
      report.warnings.push({ file: f.rel, message: "ignored: scripts/ holds <name>.sh files (and their downloads in scripts/files/)" });
      continue;
    }
    const name = base.slice(0, -3);
    const content = normalizeScript(await f.text());
    const problems = validateScript(name, content, lab.params, fileNames);
    problems.forEach((p) => err(f.rel, p));
    if (!problems.length) report.scripts.push({ name, file: f.rel, size: f.size, content });
  }

  // Brief placeholders must exist.
  const briefFile = typeof m.brief === "string" && m.brief.endsWith(".md") ? m.brief : "scenario.json";
  const onAthena = slug && opts.existingScripts && templateRefs(brief).some((r) => r.kind === "script") ? await opts.existingScripts(slug) : [];
  const usedScripts = new Set<string>();
  for (const ref of templateRefs(brief)) {
    const where = briefFile;
    if (ref.kind === "param" && !lab.params[ref.name]) err(where, `${ref.raw}: no parameter "${ref.name}" in ${labFile}`);
    else if (ref.kind === "machine" && !lab.machines[ref.role]) err(where, `${ref.raw}: no role "${ref.role}" in ${labFile}`);
    else if (ref.kind === "script") {
      usedScripts.add(ref.name);
      if (!report.scripts.some((s) => s.name === ref.name) && !onAthena.includes(ref.name)) {
        err(where, `${ref.raw}: no scripts/${ref.name}.sh in the folder${onAthena.length ? ` (this lab's scripts on Athena: ${onAthena.join(", ")})` : ""}`);
      }
    } else if (ref.kind === "file") err(where, `${ref.raw}: files are for scripts; give students a script that downloads it`);
    else if (ref.kind === "invalid") err(where, ref.reason);
  }
  const usedFiles = new Set(report.scripts.flatMap((s) => scriptFileNames(s.content)));
  for (const x of report.files.filter((f) => !usedFiles.has(f.name))) {
    report.warnings.push({ file: x.file, message: `not used by the folder's scripts: download it in one with {{file.${x.name}}}` });
  }
  for (const s of report.scripts.filter((x) => !usedScripts.has(x.name))) {
    report.warnings.push({ file: s.file, message: `not used in the brief: add {{script.${s.name}}} where students should run it` });
  }

  report.meta = {
    slug, title, type,
    description: typeof m.description === "string" ? m.description.trim() : "",
    exposure: m.exposure === "PUBLIC" ? "PUBLIC" : "ROLLOUT",
    hidden: type === "DOJO" && m.hidden === true,
    techniques: normalizeTechniques(m.techniques),
    brief,
  };

  // ── reference-evidence gate ───────────────────────────────────────────────
  const goodRel = "reference/good.evidence.json";
  const brokenRel = "reference/broken.evidence.json";
  const refs: GateReferences = {};
  if (!byRel.has(goodRel)) {
    report.draft = true;
    report.warnings.push({ file: goodRel, message: "missing, so this uploads as a draft: students can't see or start it. Run a session on a machine built from your answer key, then open it under Sessions and choose \"Save as good reference\"." });
  } else {
    const raw = await readJson(goodRel);
    if (raw != null) refs.good = raw;
  }
  if (byRel.has(brokenRel)) {
    const raw = await readJson(brokenRel);
    const expect = await readJson("reference/broken.expect.json");
    if (expect === undefined) err("reference/broken.expect.json", "missing: say which checks the broken evidence must fail, e.g. { \"fail\": [\"sqli_rule\"] }");
    if (raw != null && isObj(expect)) {
      refs.broken = raw;
      refs.brokenExpect = expect;
    }
  } else {
    report.warnings.push({ file: brokenRel, message: "no broken reference: add one (with broken.expect.json) to prove the checks fail when the work isn't done" });
  }
  const gate = runGate(lab, refs, { reportMissingGood: false }); // a missing file was reported above
  report.errors.push(...gate.errors);
  report.gate = gate.gate;
  report.references = gate.references;

  report.ok = report.errors.length === 0;
  return report;
}

export type GateReferences = { good?: unknown; broken?: unknown; brokenExpect?: unknown };

/**
 * The reference-evidence gate (spec 11): the good reference must score full
 * marks; the broken one, if given, must fail/pass/flag exactly as its
 * expectations say. Shared by folder uploads and the check editor's publish.
 */
export function runGate(lab: CompiledLab, refs: GateReferences, opts: { reportMissingGood?: boolean } = {}): {
  errors: FolderIssue[];
  gate: LabFolderReport["gate"];
  references: { good?: Evidence; broken?: Evidence; brokenExpect?: unknown };
} {
  const errors: FolderIssue[] = [];
  const gate: LabFolderReport["gate"] = {};
  const references: { good?: Evidence; broken?: Evidence; brokenExpect?: unknown } = {};
  const err = (file: string, message: string) => errors.push({ file, message });
  const goodRel = "reference/good.evidence.json";
  const brokenRel = "reference/broken.evidence.json";

  const validated = (raw: unknown, rel: string): Evidence | null => {
    const problems = validateEvidence(raw, lab);
    problems.forEach((p) => err(rel, p));
    const bad = validateParamValues(lab.params, (raw as Evidence)?.params ?? {});
    if (bad) err(rel, `${bad} — set "params" to the values the reference machine was built with`);
    return problems.length || bad ? null : (raw as Evidence);
  };

  const good = refs.good === undefined ? null : validated(refs.good, goodRel);
  if (refs.good === undefined && opts.reportMissingGood !== false) err(goodRel, "no good reference evidence: the lab can't be checked");
  if (good) {
    references.good = good;
    const g = gradeLab(lab, good, { params: good.params ?? {}, run: "final" });
    gate.good = summarize(g);
    gate.referenceParams = good.params;
    if (g.score !== g.maxScore) {
      const failing = g.checks.filter((c) => !c.passed && !c.flag && !c.skipped);
      err(goodRel, `the reference scores ${g.score}/${g.maxScore}, not full marks. Failing: ${failing.map((c) => c.id + (c.reason ? ` (${c.reason})` : "")).join("; ")}`);
    }
  }

  const broken = refs.broken === undefined ? null : validated(refs.broken, brokenRel);
  const expect = refs.brokenExpect;
  if (broken && isObj(expect)) {
    references.broken = broken;
    references.brokenExpect = expect;
    const g = gradeLab(lab, broken, { params: broken.params ?? {}, run: "final" });
    const expectations: Expectation[] = [];
    const ids = new Set(lab.checks.map((c) => c.id));
    for (const kind of ["pass", "fail"] as const) {
      const list = expect[kind];
      if (list === undefined) continue;
      if (!Array.isArray(list)) { err("reference/broken.expect.json", `${kind} must be a list of check ids`); continue; }
      for (const id of list) {
        if (!ids.has(String(id))) { err("reference/broken.expect.json", `no check "${id}"`); continue; }
        const c = g.checks.find((x) => x.id === id)!;
        const ok = kind === "pass" ? c.passed : !c.passed;
        expectations.push({ check: String(id), expected: kind, ok });
        if (!ok) err(brokenRel, `check "${id}" was expected to ${kind} but ${c.passed ? "passed" : "failed"}${c.reason ? ` (${c.reason})` : ""}`);
      }
    }
    if (expect.flags !== undefined) {
      if (!Array.isArray(expect.flags)) err("reference/broken.expect.json", "flags must be a list of flag codes");
      else for (const flag of expect.flags.map(String)) {
        const ok = g.flags.includes(flag);
        expectations.push({ check: flag, expected: "flag", ok });
        if (!ok) err(brokenRel, `flag ${flag} was expected but not raised`);
      }
    }
    gate.broken = { ...summarize(g), expectations };
  }
  return { errors, gate, references };
}
