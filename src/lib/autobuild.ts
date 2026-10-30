import AdmZip from "adm-zip";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isStorageConfigured } from "@/lib/settings";
import { putObject } from "@/lib/storage";
import { newRefToken } from "@/lib/scenarios";
import {
  parseJson,
  validateLogs,
  validateAlerts,
  validateEdr,
  validateOsquery,
  normalizeObjectives,
  normalizeFlags,
  normalizeTechniques,
} from "@/lib/scenario-schemas";
import { parseGuide, guideRelPath } from "@/lib/guide";
import { checkLabFolder, type FolderFile, type LabFolderReport } from "@/lib/labs/folder";
import { labScriptNames, largestCohortSize, saveLab } from "@/lib/labs/save";
import { labFileNames } from "@/lib/labs/lab-files";

/** A lab folder's check report, minus the compiled definition (kept server-side). */
export type LabBuildReport = Omit<LabFolderReport, "lab" | "source" | "references" | "scripts"> & {
  maxScore?: number;
  checkCount?: number;
  version?: number;
  scripts: { name: string; file: string; size: number }[];
};

export type AutoBuildResult = { error?: string; ok?: string; scenarioId?: string; lab?: LabBuildReport; dryRun?: boolean };

/** A file of a dropped bundle, at its path inside the bundle's top folder. */
export type BundleEntry = { rel: string; file: File };

function dirOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}
function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}
function contentTypeFor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return (
    { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp", zip: "application/zip" }[
      ext ?? ""
    ] ?? "application/octet-stream"
  );
}

/**
 * A bundle's entries from uploaded paths, as the browser gives them for a
 * dropped folder (`<folder>/scenario.json`, …): the top folder is dropped.
 */
export function bundleFromPaths(paths: string[], files: File[]): BundleEntry[] {
  return paths.map((p, i) => ({ rel: guideRelPath(p), file: files[i] }));
}

/**
 * A bundle's entries from a zip. The zip holds the bundle's folder
 * (`<folder>/scenario.json`, …), like a dropped folder; a zip of the folder's
 * contents (`scenario.json` at the top) works too. Directories and macOS junk
 * (`__MACOSX/`, `.DS_Store`) are skipped.
 */
export function bundleFromZip(zip: Uint8Array): BundleEntry[] {
  const names: { name: string; data: Buffer }[] = [];
  for (const e of new AdmZip(Buffer.from(zip)).getEntries()) {
    if (e.isDirectory) continue;
    const name = e.entryName.replace(/\\/g, "/");
    if (name.startsWith("__MACOSX/") || name.split("/").pop() === ".DS_Store") continue;
    names.push({ name, data: e.getData() });
  }
  const tops = new Set(names.map((n) => (n.name.includes("/") ? n.name.split("/")[0] : "")));
  const wrapped = tops.size === 1 && !tops.has("");
  return names.map(({ name, data }) => ({
    rel: wrapped ? guideRelPath(name) : guideRelPath(`bundle/${name}`),
    file: new File([new Uint8Array(data)], name.split("/").pop() ?? name),
  }));
}

/**
 * Auto-build a whole scenario from a bundle (see docs/autobuild.md): a dropped
 * folder on the Auto-builder page, or a zip over MCP (docs/mcp.md). The
 * bundle's `scenario.json` manifest references the brief, guide, logs/alerts
 * bundles, and per-endpoint EDR/OSQuery/artifacts; this reads, validates, and
 * materializes all of it in one shot. Everything is validated before any DB
 * write so a bad bundle fails cleanly. `dryRun` stops after validation.
 */
export async function autoBuildBundle(entries: BundleEntry[], actorId: string, opts: { dryRun?: boolean } = {}): Promise<AutoBuildResult> {
  if (!entries.length) return { error: "No files received." };
  const architect = { id: actorId };
  const map = new Map(entries.map((e) => [e.rel, e.file]));
  const readText = async (rel: string) => {
    const f = map.get(rel);
    return f ? await f.text() : null;
  };

  // ── manifest ──────────────────────────────────────────────────────────────
  const manifestText = await readText("scenario.json");
  if (!manifestText) return { error: "The folder must contain a scenario.json manifest at its root." };
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(manifestText);
  } catch (e) {
    return { error: `scenario.json is not valid JSON: ${e instanceof Error ? e.message : "parse error"}` };
  }

  if (m.kind === "LAB") return buildLab(entries, architect.id, Boolean(opts.dryRun));

  const type = m.type === "ASSESSMENT" ? "ASSESSMENT" : "DOJO";
  const title = String(m.title ?? "").trim();
  if (!title) return { error: "scenario.json: `title` is required." };
  const description = String(m.description ?? "").trim();
  const exposure = m.exposure === "PUBLIC" ? "PUBLIC" : "ROLLOUT";
  const hidden = type === "DOJO" && Boolean(m.hidden);
  const realtime = Boolean(m.realtime);
  const reportRequired = Boolean((m.report as { required?: boolean })?.required);
  const reportPrompt = String((m.report as { prompt?: string })?.prompt ?? "").trim() || null;

  // ── brief (path to .md, or inline string) ──────────────────────────────────
  let brief = "";
  if (typeof m.brief === "string" && m.brief) {
    if (m.brief.endsWith(".md")) {
      const t = await readText(m.brief);
      if (t == null) return { error: `scenario.json: brief file "${m.brief}" not found in the folder.` };
      brief = t;
    } else {
      brief = m.brief;
    }
  }

  const objectives = normalizeObjectives(((m.objectives as string[]) ?? []).map((t) => ({ text: String(t) })));
  const flags = normalizeFlags((m.flags as { question: string; answer: string; points?: number }[]) ?? []);

  // ── logs / alerts ───────────────────────────────────────────────────────────
  const readBundle = async (
    ref: unknown,
    label: string,
    validate: (d: unknown) => { ok: boolean; error?: string; data?: unknown },
  ): Promise<{ error?: string; data?: unknown }> => {
    if (typeof ref !== "string" || !ref) return {};
    const t = await readText(ref);
    if (t == null) return { error: `${label} file "${ref}" not found in the folder.` };
    const parsed = parseJson(t);
    if (!parsed.ok) return { error: `${label} (${ref}): ${parsed.error}` };
    const v = validate(parsed.data);
    if (!v.ok) return { error: `${label} (${ref}): ${v.error}` };
    return { data: v.data };
  };

  const logsRes = await readBundle(m.logs, "logs", validateLogs);
  if (logsRes.error) return { error: logsRes.error };
  const alertsRes = await readBundle(m.alerts, "alerts", validateAlerts);
  if (alertsRes.error) return { error: alertsRes.error };

  // ATT&CK tags: the manifest's list plus any tagged on individual alerts.
  const alertList = ((alertsRes.data as { alerts?: { techniques?: unknown[] }[] })?.alerts ?? []);
  const techniques = normalizeTechniques([
    ...(Array.isArray(m.techniques) ? m.techniques : []),
    ...alertList.flatMap((a) => a.techniques ?? []),
  ]);

  // ── guide ─────────────────────────────────────────────────────────────────
  let guide: string | null = null;
  let guidePrompts: unknown = undefined;
  let guideAssets: { rel: string; file: File }[] = [];
  if (typeof m.guide === "string" && m.guide) {
    const gmd = await readText(m.guide);
    if (gmd == null) return { error: `scenario.json: guide file "${m.guide}" not found in the folder.` };
    const parsed = parseGuide(gmd);
    guide = parsed.guide;
    guidePrompts = parsed.prompts;
    const gdir = dirOf(m.guide);
    if (gdir) {
      const prefix = `${gdir}/`;
      guideAssets = entries
        .filter((e) => e.rel.startsWith(prefix) && e.rel !== m.guide && e.file.size > 0)
        .map((e) => ({ rel: e.rel.slice(prefix.length), file: e.file }));
    }
  }

  // ── endpoints ───────────────────────────────────────────────────────────────
  type EndpointPlan = { hostname: string; edr?: unknown; osquery?: unknown; artifact?: File };
  const endpointPlans: EndpointPlan[] = [];
  for (const raw of (m.endpoints as Record<string, string>[]) ?? []) {
    const hostname = String(raw.hostname ?? "").trim();
    if (!hostname) return { error: "scenario.json: each endpoint needs a `hostname`." };
    const plan: EndpointPlan = { hostname };
    if (raw.edr) {
      const r = await readBundle(raw.edr, `endpoint ${hostname} EDR`, validateEdr);
      if (r.error) return { error: r.error };
      plan.edr = r.data;
    }
    if (raw.osquery) {
      const r = await readBundle(raw.osquery, `endpoint ${hostname} OSQuery`, validateOsquery);
      if (r.error) return { error: r.error };
      plan.osquery = r.data;
    }
    if (raw.artifact) {
      const f = map.get(raw.artifact);
      if (!f) return { error: `endpoint ${hostname}: artifact "${raw.artifact}" not found in the folder.` };
      plan.artifact = f;
    }
    endpointPlans.push(plan);
  }

  // ── storage precondition ────────────────────────────────────────────────────
  const needsStorage = guideAssets.length > 0 || endpointPlans.some((e) => e.artifact);
  if (needsStorage && !(await isStorageConfigured())) {
    return { error: "This bundle includes images/artifacts — configure object storage (Settings → Storage) first." };
  }

  if (opts.dryRun) {
    const parts = [
      type === "ASSESSMENT" ? "Assessment" : "Dojo",
      `${endpointPlans.length} endpoint${endpointPlans.length === 1 ? "" : "s"}`,
      guide ? "guide" : null,
      flags.length ? `${flags.length} flags` : null,
      logsRes.data ? `${(logsRes.data as { entries: unknown[] }).entries.length} log entries` : null,
      alertsRes.data ? `${(alertsRes.data as { alerts: unknown[] }).alerts.length} alerts` : null,
    ].filter(Boolean);
    return { ok: `“${title}” is valid and would be built as a new scenario: ${parts.join(", ")}. Nothing was saved.`, dryRun: true };
  }

  // ── everything validated → create ───────────────────────────────────────────
  const scenario = await prisma.scenario.create({
    data: {
      type,
      title,
      description,
      exposure,
      hidden,
      realtime,
      brief,
      objectives: objectives.length ? objectives : undefined,
      flags: flags.length ? flags : undefined,
      reportRequired,
      reportPrompt,
      logs: (logsRes.data as object) ?? undefined,
      alerts: (alertsRes.data as object) ?? undefined,
      guide,
      guidePrompts: guidePrompts as object | undefined,
      guideAssets: guideAssets.length ? guideAssets.map((a) => a.rel) : undefined,
      techniques,
      refToken: newRefToken(),
      createdById: architect.id,
    },
  });

  try {
    for (const a of guideAssets) {
      await putObject(`scenarios/${scenario.id}/guide/${a.rel}`, Buffer.from(await a.file.arrayBuffer()), contentTypeFor(a.rel));
    }
    for (const ep of endpointPlans) {
      let artifactKey: string | undefined;
      let artifactName: string | undefined;
      let artifactSize: number | undefined;
      if (ep.artifact) {
        artifactKey = `scenarios/${scenario.id}/${sanitize(ep.hostname)}/${sanitize(ep.artifact.name)}`;
        await putObject(artifactKey, Buffer.from(await ep.artifact.arrayBuffer()), contentTypeFor(ep.artifact.name));
        artifactName = ep.artifact.name;
        artifactSize = ep.artifact.size;
      }
      await prisma.scenarioEndpoint.create({
        data: {
          scenarioId: scenario.id,
          hostname: ep.hostname,
          edr: (ep.edr as object) ?? undefined,
          osquery: (ep.osquery as object) ?? undefined,
          artifactKey,
          artifactName,
          artifactSize,
        },
      });
    }
  } catch (e) {
    return { error: `Scenario created, but an upload failed: ${e instanceof Error ? e.message : "error"}. Finish it in the editor.`, scenarioId: scenario.id };
  }

  revalidatePath("/admin/scenarios");
  const parts = [
    `${endpointPlans.length} endpoint${endpointPlans.length === 1 ? "" : "s"}`,
    guide ? "guide" : null,
    flags.length ? `${flags.length} flags` : null,
    logsRes.data ? "logs" : null,
    alertsRes.data ? "alerts" : null,
  ].filter(Boolean);
  return { ok: `Built “${title}” — ${parts.join(", ")}.`, scenarioId: scenario.id };
}

/**
 * A `"kind": "LAB"` folder (docs/labs/spec.md section 10): compile lab.yaml,
 * run the reference-evidence gate, then save a new lab or a new version of it.
 */
async function buildLab(entries: BundleEntry[], architectId: string, dryRun: boolean): Promise<AutoBuildResult> {
  const files: FolderFile[] = entries.map(({ rel, file }) => ({
    rel,
    size: file.size,
    text: () => file.text(),
    bytes: async () => new Uint8Array(await file.arrayBuffer()),
  }));
  const report = await checkLabFolder(files, { maxCohortSize: (await largestCohortSize()) || undefined, existingScripts: labScriptNames, existingFiles: labFileNames });
  const { lab, source: _source, references: _references, scripts, ...rest } = report;
  void _source;
  void _references;
  const summary: LabBuildReport = {
    ...rest,
    maxScore: lab?.maxScore,
    checkCount: lab?.checks.length,
    scripts: scripts.map(({ name, file, size }) => ({ name, file, size })),
  };
  if (!report.ok) {
    return { error: `The lab was not accepted: ${report.errors.length} problem${report.errors.length === 1 ? "" : "s"} to fix.`, lab: summary };
  }
  if (dryRun) {
    return { ok: `Lab “${report.meta!.title}” passed the checks${report.draft ? " (as a draft: no good reference yet)" : ""}. Nothing was saved.`, lab: summary, dryRun: true };
  }
  const saved = await saveLab(report, files, architectId);
  if (!saved.ok) return { error: saved.error, lab: summary };
  revalidatePath("/admin/scenarios");
  const good = report.gate.good;
  return {
    ok: report.draft
      ? `${saved.created ? "Created" : "Updated"} lab “${report.meta!.title}” — version ${saved.version} is a draft: run it on your answer-key machine and save that session as the good reference.`
      : `${saved.created ? "Created" : "Updated"} lab “${report.meta!.title}” — version ${saved.version}, reference ${good?.score}/${good?.maxScore}${scripts.length ? `, ${scripts.length} script${scripts.length === 1 ? "" : "s"}` : ""}${report.files.length ? `, ${report.files.length} file${report.files.length === 1 ? "" : "s"}` : ""}.`,
    scenarioId: saved.scenarioId,
    lab: { ...summary, version: saved.version },
  };
}
