import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isStorageConfigured } from "@/lib/settings";
import { normalizeTechniques } from "@/lib/scenario-schemas";
import { removeLabFile, saveLabFile } from "./lab-files";
import { briefScriptNames, normalizeScript, scriptFileNames, validateScript } from "./scripts";
import { templateRefs } from "./language/template";
import type { CompiledLab } from "./language/types";

/**
 * Changing a lab after it's built: who can see it, its card and brief, its
 * scripts and files. Shared by the lab page's Server Actions and the MCP tools
 * (docs/mcp.md), so both apply the same rules. Each change runs as `actorId`
 * (an architect; callers check) and is written to the lab audit log.
 */

export type Manage<T = object> = ({ ok: true } & T) | { ok?: false; error: string };

const audit = (type: string, actorId: string, detail: Record<string, unknown>) =>
  prisma.labAuditEvent.create({ data: { type, userId: actorId, detail: detail as object } });

function refresh(scenarioId: string, list = false) {
  revalidatePath(`/admin/scenarios/${scenarioId}`);
  if (list) revalidatePath("/admin/scenarios");
}

export type Visibility = { exposure: "ROLLOUT" | "PUBLIC"; hidden: boolean };

/**
 * Who can see a lab. ROLLOUT: the cohorts it's released to; PUBLIC: every
 * student. Hidden (Dojos only, as for SOC scenarios) keeps it off students'
 * lists, so only its link opens it. Kept across re-uploads.
 */
export async function setLabVisibilityAs(actorId: string, scenarioId: string, want: Visibility): Promise<Manage<Visibility>> {
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId }, select: { kind: true, type: true, exposure: true, hidden: true } });
  if (scenario?.kind !== "LAB") return { error: "No such lab." };
  if (want.hidden && scenario.type !== "DOJO") return { error: "Only Dojo labs can be hidden: assessments are always listed to the students they're released to." };
  const next: Visibility = { exposure: want.exposure === "PUBLIC" ? "PUBLIC" : "ROLLOUT", hidden: scenario.type === "DOJO" && want.hidden };
  await prisma.scenario.update({ where: { id: scenarioId }, data: next });
  await audit("LAB_VISIBILITY", actorId, { scenarioId, from: { exposure: scenario.exposure, hidden: scenario.hidden }, to: next });
  refresh(scenarioId, true);
  return { ok: true, ...next };
}

/** Release a lab to exactly these cohorts (adds and removes bindings). */
export async function setLabCohortsAs(actorId: string, scenarioId: string, cohortIds: string[]): Promise<Manage<{ added: string[]; removed: string[] }>> {
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId }, select: { kind: true } });
  if (scenario?.kind !== "LAB") return { error: "No such lab." };
  const wanted = (await prisma.cohort.findMany({ where: { id: { in: cohortIds } }, select: { id: true } })).map((c) => c.id);
  const unknown = cohortIds.filter((id) => !wanted.includes(id));
  if (unknown.length) return { error: `No cohort with id ${unknown.join(", ")}.` };
  const current = (await prisma.cohortScenario.findMany({ where: { scenarioId }, select: { cohortId: true } })).map((b) => b.cohortId);
  const added = wanted.filter((id) => !current.includes(id));
  const removed = current.filter((id) => !wanted.includes(id));
  await prisma.$transaction([
    prisma.cohortScenario.deleteMany({ where: { scenarioId, cohortId: { in: removed } } }),
    prisma.cohortScenario.createMany({ data: added.map((cohortId) => ({ cohortId, scenarioId, boundById: actorId })), skipDuplicates: true }),
  ]);
  if (added.length || removed.length) await audit("LAB_COHORTS", actorId, { scenarioId, added, removed });
  refresh(scenarioId);
  for (const id of [...added, ...removed]) revalidatePath(`/admin/cohorts/${id}`);
  return { ok: true, added, removed };
}

export type LabDetails = { title?: string; description?: string; brief?: string; techniques?: unknown };

/**
 * Change a lab's card (title, description, ATT&CK techniques) and brief
 * without a new version. The brief's placeholders are checked against the
 * latest version's params and roles and the lab's scripts, as at upload.
 * A later folder upload replaces all of these again.
 */
export async function updateLabDetailsAs(actorId: string, labId: string, input: LabDetails): Promise<Manage<{ changed: string[] }>> {
  const lab = await prisma.lab.findUnique({
    where: { id: labId },
    select: {
      scenarioId: true,
      versions: { orderBy: { version: "desc" }, take: 1, select: { definition: true } },
      scripts: { select: { name: true } },
    },
  });
  if (!lab) return { error: "No such lab." };
  const data: { title?: string; description?: string; brief?: string; techniques?: string[] } = {};
  if (input.title !== undefined) {
    const title = String(input.title).trim();
    if (!title) return { error: "The title can't be empty." };
    data.title = title.slice(0, 200);
  }
  if (input.description !== undefined) data.description = String(input.description).trim();
  if (input.techniques !== undefined) data.techniques = normalizeTechniques(input.techniques);
  if (input.brief !== undefined) {
    const brief = String(input.brief);
    if (!brief.trim()) return { error: "The brief can't be empty." };
    const def = lab.versions[0]?.definition as unknown as CompiledLab | undefined;
    const scripts = lab.scripts.map((s) => s.name);
    const problems: string[] = [];
    for (const ref of templateRefs(brief)) {
      if (ref.kind === "param" && !def?.params[ref.name]) problems.push(`${ref.raw}: no parameter "${ref.name}" in lab.yaml`);
      else if (ref.kind === "machine" && !def?.machines[ref.role]) problems.push(`${ref.raw}: no role "${ref.role}" in lab.yaml`);
      else if (ref.kind === "script" && !scripts.includes(ref.name)) problems.push(`${ref.raw}: the lab has no script "${ref.name}"${scripts.length ? ` (it has: ${scripts.join(", ")})` : ""}`);
      else if (ref.kind === "file") problems.push(`${ref.raw}: files are for scripts; give students a script that downloads it`);
      else if (ref.kind === "invalid") problems.push(ref.reason);
    }
    if (problems.length) return { error: problems.join("; ") };
    data.brief = brief;
  }
  const changed = Object.keys(data);
  if (!changed.length) return { error: "Nothing to change: give a title, description, brief or techniques." };
  await prisma.scenario.update({ where: { id: lab.scenarioId }, data });
  await audit("LAB_DETAILS", actorId, { labId, changed });
  refresh(lab.scenarioId, Boolean(data.title || data.description));
  return { ok: true, changed };
}

/**
 * Add or replace a lab script (docs/labs/scripts.md). `create` refuses to
 * overwrite an existing script of that name.
 */
export async function saveLabScriptAs(actorId: string, labId: string, rawName: string, rawContent: string, create: boolean): Promise<Manage<{ name: string; created: boolean }>> {
  const lab = await prisma.lab.findUnique({
    where: { id: labId },
    select: { scenarioId: true, versions: { orderBy: { version: "desc" }, take: 1, select: { definition: true } }, files: { select: { name: true } } },
  });
  if (!lab) return { error: "No such lab." };
  const name = String(rawName ?? "").trim().replace(/\.sh$/, "");
  const content = normalizeScript(String(rawContent ?? ""));
  const params = (lab.versions[0]?.definition as unknown as CompiledLab | undefined)?.params ?? null;
  const problems = validateScript(name, content, params, lab.files.map((f) => f.name));
  if (problems.length) return { error: problems.join("; ") };
  const exists = Boolean(await prisma.labScript.findUnique({ where: { labId_name: { labId, name } }, select: { id: true } }));
  if (create && exists) return { error: `This lab already has a script called "${name}". Edit that one, or pick another name.` };
  await prisma.labScript.upsert({
    where: { labId_name: { labId, name } },
    update: { content, updatedById: actorId },
    create: { labId, name, content, updatedById: actorId },
  });
  await audit("LAB_SCRIPT_SAVED", actorId, { labId, name, created: !exists });
  refresh(lab.scenarioId);
  return { ok: true, name, created: !exists };
}

/** Delete a lab script; refused while the brief still hands it out. Students' links stop working. */
export async function deleteLabScriptAs(actorId: string, labId: string, name: string): Promise<Manage> {
  const lab = await prisma.lab.findUnique({ where: { id: labId }, select: { scenarioId: true, scenario: { select: { brief: true } } } });
  if (!lab) return { error: "No such lab." };
  if (briefScriptNames(lab.scenario.brief).includes(name)) {
    return { error: `The brief still uses {{script.${name}}}. Take it out of the brief first.` };
  }
  const { count } = await prisma.labScript.deleteMany({ where: { labId, name } });
  if (!count) return { error: `This lab has no script called "${name}".` };
  await audit("LAB_SCRIPT_DELETED", actorId, { labId, name });
  refresh(lab.scenarioId);
  return { ok: true };
}

/** Upload (or replace) a file the lab's scripts download with {{file.<name>}}. */
export async function saveLabFileAs(actorId: string, labId: string, filename: string, bytes: Uint8Array): Promise<Manage<{ name: string }>> {
  const lab = await prisma.lab.findUnique({ where: { id: labId }, select: { scenarioId: true } });
  if (!lab) return { error: "No such lab." };
  if (!(await isStorageConfigured())) return { error: "Configure object storage (Settings → Storage) before uploading files." };
  try {
    const res = await saveLabFile(labId, filename, bytes, actorId);
    if (!res.ok) return { error: res.error };
    await audit("LAB_FILE_SAVED", actorId, { labId, name: res.name, filename, size: bytes.length });
    refresh(lab.scenarioId);
    return { ok: true, name: res.name };
  } catch (e) {
    return { error: `Uploading the file failed: ${e instanceof Error ? e.message : e}` };
  }
}

/** Delete a lab file; refused while a script still downloads it. */
export async function deleteLabFileAs(actorId: string, labId: string, name: string): Promise<Manage> {
  const lab = await prisma.lab.findUnique({ where: { id: labId }, select: { scenarioId: true, scripts: { select: { name: true, content: true } }, files: { select: { name: true } } } });
  if (!lab) return { error: "No such lab." };
  if (!lab.files.some((f) => f.name === name)) return { error: `This lab has no file called "${name}".` };
  const users = lab.scripts.filter((s) => scriptFileNames(s.content).includes(name)).map((s) => `${s.name}.sh`);
  if (users.length) return { error: `${users.join(", ")} still ${users.length === 1 ? "uses" : "use"} {{file.${name}}}. Take it out of ${users.length === 1 ? "that script" : "those scripts"} first.` };
  await removeLabFile(labId, name);
  await audit("LAB_FILE_DELETED", actorId, { labId, name });
  refresh(lab.scenarioId);
  return { ok: true };
}
