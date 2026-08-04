"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireArchitect } from "@/lib/auth";
import { putObject, deleteObject } from "@/lib/storage";
import { isStorageConfigured } from "@/lib/settings";
import {
  parseJson,
  validateLogs,
  validateAlerts,
  validateEdr,
  validateOsquery,
  normalizeObjectives,
  normalizeFlags,
} from "@/lib/scenario-schemas";
import { newRefToken } from "@/lib/scenarios";

export type ScenarioFormState = { error?: string; ok?: string };

/** Read a JSON section from either an uploaded file or a pasted textarea. */
async function readJsonSection(
  formData: FormData,
  textKey: string,
  fileKey: string,
): Promise<{ present: boolean; text: string }> {
  const file = formData.get(fileKey);
  if (file instanceof File && file.size > 0) {
    return { present: true, text: await file.text() };
  }
  const text = String(formData.get(textKey) ?? "").trim();
  return { present: Boolean(text), text };
}

function parseJsonArray(raw: string): unknown[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ── Create / update ─────────────────────────────────────────────────────────
export async function createScenario(
  _prevState: ScenarioFormState,
  formData: FormData,
): Promise<ScenarioFormState> {
  const architect = await requireArchitect();

  const type = formData.get("type") === "ASSESSMENT" ? "ASSESSMENT" : "DOJO";
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const exposure = formData.get("exposure") === "PUBLIC" ? "PUBLIC" : "ROLLOUT";
  const hidden = type === "DOJO" && formData.get("hidden") === "on";
  const brief = String(formData.get("brief") ?? "");
  const reportRequired = formData.get("reportRequired") === "on";
  const reportPrompt = String(formData.get("reportPrompt") ?? "").trim() || null;

  if (!title) return { error: "Title is required." };

  const objectives = normalizeObjectives(
    parseJsonArray(String(formData.get("objectivesJson") ?? "[]")) as { text: string }[],
  );
  const flags = normalizeFlags(
    parseJsonArray(String(formData.get("flagsJson") ?? "[]")) as { question: string; answer: string; points?: number }[],
  );

  // Optional log/alert bundles.
  let logs: unknown = undefined;
  const logsSec = await readJsonSection(formData, "logsJson", "logsFile");
  if (logsSec.present) {
    const parsed = parseJson(logsSec.text);
    if (!parsed.ok) return { error: `Logs: ${parsed.error}` };
    const v = validateLogs(parsed.data);
    if (!v.ok) return { error: `Logs: ${v.error}` };
    logs = v.data;
  }

  let alerts: unknown = undefined;
  const alertsSec = await readJsonSection(formData, "alertsJson", "alertsFile");
  if (alertsSec.present) {
    const parsed = parseJson(alertsSec.text);
    if (!parsed.ok) return { error: `Alerts: ${parsed.error}` };
    const v = validateAlerts(parsed.data);
    if (!v.ok) return { error: `Alerts: ${v.error}` };
    alerts = v.data;
  }

  const scenario = await prisma.scenario.create({
    data: {
      type,
      title,
      description,
      exposure,
      hidden,
      brief,
      reportRequired,
      reportPrompt,
      objectives: objectives.length ? objectives : undefined,
      flags: flags.length ? flags : undefined,
      logs: logs ?? undefined,
      alerts: alerts ?? undefined,
      refToken: newRefToken(),
      createdById: architect.id,
    },
  });

  revalidatePath("/admin/scenarios");
  redirect(`/admin/scenarios/${scenario.id}`);
}

export async function updateScenarioBasics(
  scenarioId: string,
  _prevState: ScenarioFormState,
  formData: FormData,
): Promise<ScenarioFormState> {
  await requireArchitect();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const type = formData.get("type") === "ASSESSMENT" ? "ASSESSMENT" : "DOJO";
  const objectives = normalizeObjectives(
    parseJsonArray(String(formData.get("objectivesJson") ?? "[]")) as { text: string }[],
  );
  const flags = normalizeFlags(
    parseJsonArray(String(formData.get("flagsJson") ?? "[]")) as { question: string; answer: string; points?: number }[],
  );

  await prisma.scenario.update({
    where: { id: scenarioId },
    data: {
      type,
      title,
      description: String(formData.get("description") ?? "").trim(),
      exposure: formData.get("exposure") === "PUBLIC" ? "PUBLIC" : "ROLLOUT",
      hidden: type === "DOJO" && formData.get("hidden") === "on",
      brief: String(formData.get("brief") ?? ""),
      reportRequired: formData.get("reportRequired") === "on",
      reportPrompt: String(formData.get("reportPrompt") ?? "").trim() || null,
      objectives,
      flags,
    },
  });

  revalidatePath(`/admin/scenarios/${scenarioId}`);
  return { ok: "Scenario saved." };
}

export async function deleteScenario(scenarioId: string): Promise<{ error?: string }> {
  await requireArchitect();
  const endpoints = await prisma.scenarioEndpoint.findMany({
    where: { scenarioId, artifactKey: { not: null } },
    select: { artifactKey: true },
  });
  await prisma.scenario.delete({ where: { id: scenarioId } }).catch(() => {});
  // Best-effort cleanup of stored artifacts.
  for (const e of endpoints) if (e.artifactKey) await deleteObject(e.artifactKey).catch(() => {});
  revalidatePath("/admin/scenarios");
  redirect("/admin/scenarios");
}

// ── Endpoints (EDR / OSQuery / artifact) ────────────────────────────────────
function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export async function saveEndpoint(
  scenarioId: string,
  _prevState: ScenarioFormState,
  formData: FormData,
): Promise<ScenarioFormState> {
  await requireArchitect();

  const hostname = String(formData.get("hostname") ?? "").trim();
  if (!hostname) return { error: "Endpoint hostname is required." };

  let edr: unknown = undefined;
  const edrSec = await readJsonSection(formData, "edrJson", "edrFile");
  if (edrSec.present) {
    const parsed = parseJson(edrSec.text);
    if (!parsed.ok) return { error: `EDR: ${parsed.error}` };
    const v = validateEdr(parsed.data);
    if (!v.ok) return { error: `EDR: ${v.error}` };
    edr = v.data;
  }

  let osquery: unknown = undefined;
  const osqSec = await readJsonSection(formData, "osqueryJson", "osqueryFile");
  if (osqSec.present) {
    const parsed = parseJson(osqSec.text);
    if (!parsed.ok) return { error: `OSQuery: ${parsed.error}` };
    const v = validateOsquery(parsed.data);
    if (!v.ok) return { error: `OSQuery: ${v.error}` };
    osquery = v.data;
  }

  // Optional evidence zip → object storage.
  let artifact: { key: string; name: string; size: number } | undefined;
  const zip = formData.get("artifact");
  if (zip instanceof File && zip.size > 0) {
    if (!(await isStorageConfigured())) {
      return { error: "Configure object storage in Settings → Storage before uploading artifacts." };
    }
    const key = `scenarios/${scenarioId}/${sanitize(hostname)}/${sanitize(zip.name || "artifact.zip")}`;
    try {
      await putObject(key, Buffer.from(await zip.arrayBuffer()), zip.type || "application/zip");
      artifact = { key, name: zip.name, size: zip.size };
    } catch (e) {
      return { error: `Artifact upload failed: ${e instanceof Error ? e.message : "unknown"}` };
    }
  }

  await prisma.scenarioEndpoint.upsert({
    where: { scenarioId_hostname: { scenarioId, hostname } },
    update: {
      edr: edr ?? undefined,
      osquery: osquery ?? undefined,
      ...(artifact ? { artifactKey: artifact.key, artifactName: artifact.name, artifactSize: artifact.size } : {}),
    },
    create: {
      scenarioId,
      hostname,
      edr: edr ?? undefined,
      osquery: osquery ?? undefined,
      artifactKey: artifact?.key,
      artifactName: artifact?.name,
      artifactSize: artifact?.size,
    },
  });

  revalidatePath(`/admin/scenarios/${scenarioId}`);
  return { ok: `Endpoint ${hostname} saved.` };
}

export async function removeEndpoint(endpointId: string): Promise<{ error?: string }> {
  await requireArchitect();
  const ep = await prisma.scenarioEndpoint.findUnique({ where: { id: endpointId } });
  if (!ep) return { error: "Endpoint not found." };
  await prisma.scenarioEndpoint.delete({ where: { id: endpointId } });
  if (ep.artifactKey) await deleteObject(ep.artifactKey).catch(() => {});
  revalidatePath(`/admin/scenarios/${ep.scenarioId}`);
  return {};
}
