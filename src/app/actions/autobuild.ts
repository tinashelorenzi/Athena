"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireArchitect } from "@/lib/auth";
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
} from "@/lib/scenario-schemas";
import { parseGuide, guideRelPath } from "@/lib/guide";

export type AutoBuildResult = { error?: string; ok?: string; scenarioId?: string };

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
 * Auto-build a whole scenario from a single dropped folder (see
 * docs/autobuild.md). The folder's `scenario.json` manifest references the brief,
 * guide, logs/alerts bundles, and per-endpoint EDR/OSQuery/artifacts; this reads,
 * validates, and materializes all of it in one shot. Everything is validated
 * before any DB write so a bad bundle fails cleanly.
 */
export async function autoBuildScenario(formData: FormData): Promise<AutoBuildResult> {
  const architect = await requireArchitect();

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  let paths: string[] = [];
  try {
    paths = JSON.parse(String(formData.get("paths") ?? "[]"));
  } catch {
    paths = [];
  }
  if (!files.length || files.length !== paths.length) return { error: "No files received." };

  const entries = paths.map((p, i) => ({ rel: guideRelPath(p), file: files[i] }));
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

  const type = m.type === "ASSESSMENT" ? "ASSESSMENT" : "DOJO";
  const title = String(m.title ?? "").trim();
  if (!title) return { error: "scenario.json: `title` is required." };
  const description = String(m.description ?? "").trim();
  const exposure = m.exposure === "PUBLIC" ? "PUBLIC" : "ROLLOUT";
  const hidden = type === "DOJO" && Boolean(m.hidden);
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

  // ── everything validated → create ───────────────────────────────────────────
  const scenario = await prisma.scenario.create({
    data: {
      type,
      title,
      description,
      exposure,
      hidden,
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
