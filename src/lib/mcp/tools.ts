import AdmZip from "adm-zip";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getBaseUrl } from "@/lib/url";
import { getObjectStream } from "@/lib/storage";
import { getGradingQueue, gradeSubmissionAs, setGradeReleasedAs, setSubmissionCommittedAs, type GradeChange, type QueueItem } from "@/lib/grading";
import { applyRegrade, getSessionDetail, listLabSessions, previewRegrade, setScoreOverride, type RegradeTarget } from "@/lib/labs/admin";
import { LabError } from "@/lib/labs/sessions";
import { briefScriptNames, scriptFileNames } from "@/lib/labs/scripts";
import type { CompiledLab } from "@/lib/labs/language/types";
import { autoBuildBundle, bundleFromZip, type BundleEntry } from "@/lib/autobuild";
import { argBool, argEnum, argNum, argStr, argStrList, page, ToolContent, ToolError, type Tool } from "./server";

/**
 * The Athena MCP tools (docs/mcp.md). Every tool runs as the architect whose
 * key made the request; the route has already checked they are one.
 */

const MAX_BUNDLE_BYTES = 95 * 1024 * 1024;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const clip = (s: string | null | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n)}… (${s.length} chars; get_submission has all of it)` : s ?? "");

/** Run lab code, turning its user-facing errors into tool errors. */
async function lab<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof LabError) throw new ToolError(e.message);
    throw e;
  }
}

function afterGrading(res: GradeChange) {
  if (res.error) throw new ToolError(res.error);
  if (res.cohortId) revalidatePath(`/admin/cohorts/${res.cohortId}`);
  revalidatePath("/admin/grading");
}

/** A lab by its scenario id or its slug. */
async function findLab(args: Record<string, unknown>) {
  const scenarioId = argStr(args, "scenario_id");
  const slug = argStr(args, "slug");
  if (!scenarioId && !slug) throw new ToolError("Give `scenario_id` or `slug`.");
  const found = await prisma.lab.findFirst({
    where: scenarioId ? { scenarioId } : { slug },
    include: { scenario: { select: { id: true, title: true, type: true, brief: true } } },
  });
  if (!found) throw new ToolError(scenarioId ? "No lab with that scenario_id (is it a SOC scenario? Use get_scenario)." : `No lab with slug "${slug}".`);
  return found;
}

/** Plain text of a .docx (paragraphs and tabs kept). */
function docxText(bytes: Uint8Array): string | null {
  try {
    const xml = new AdmZip(Buffer.from(bytes)).readAsText("word/document.xml");
    if (!xml) return null;
    return xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return null;
  }
}

function submissionWhere(args: Record<string, unknown>): Prisma.SubmissionWhereInput {
  const status = argEnum(args, "status", ["needs_grading", "held", "released", "graded", "all"] as const, "needs_grading");
  const where: Prisma.SubmissionWhereInput = {};
  if (status === "needs_grading") where.status = "SUBMITTED";
  if (status === "held") Object.assign(where, { status: "GRADED", releasedAt: null });
  if (status === "released") where.releasedAt = { not: null };
  if (status === "graded") where.status = "GRADED";
  const scenarioId = argStr(args, "scenario_id");
  if (scenarioId) where.scenarioId = scenarioId;
  const cohortId = argStr(args, "cohort_id");
  const student = argStr(args, "student");
  if (cohortId || student) {
    where.student = {
      ...(cohortId ? { cohortId } : {}),
      ...(student
        ? { OR: [{ id: student }, { email: { contains: student, mode: "insensitive" } }, { name: { contains: student, mode: "insensitive" } }, { studentNumber: student }] }
        : {}),
    };
  }
  return where;
}

const summary = (q: QueueItem) => ({ ...q, report: clip(q.report, 400), flagReview: undefined });

/* ── reading ─────────────────────────────────────────────────────────────────── */

const whoami: Tool = {
  name: "whoami",
  title: "Who am I",
  description: "The Athena account this key acts as, the Athena URL, and how much there is (scenarios, cohorts, submissions waiting to be graded).",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: true },
  run: async (_args, actor) => {
    const [scenarios, labs, cohorts, needsGrading] = await Promise.all([
      prisma.scenario.count({ where: { kind: "SOC" } }),
      prisma.scenario.count({ where: { kind: "LAB" } }),
      prisma.cohort.count(),
      prisma.submission.count({ where: { status: "SUBMITTED" } }),
    ]);
    return { user: actor, role: "instructor (architect)", athena: await getBaseUrl(), counts: { socScenarios: scenarios, labs, cohorts, submissionsNeedingGrading: needsGrading } };
  },
};

const listScenarios: Tool = {
  name: "list_scenarios",
  title: "List scenarios",
  description: "Every scenario: SOC Dojos and Assessments (SIEM-style, graded on flags and a report) and labs (kind LAB, graded by checks on the student's own machines). Filter by kind, type or a title search.",
  inputSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["SOC", "LAB"] },
      type: { type: "string", enum: ["DOJO", "ASSESSMENT"] },
      search: { type: "string", description: "Part of the title (case-insensitive)." },
    },
  },
  annotations: { readOnlyHint: true },
  run: async (args) => {
    const kind = argEnum(args, "kind", ["SOC", "LAB"] as const);
    const type = argEnum(args, "type", ["DOJO", "ASSESSMENT"] as const);
    const search = argStr(args, "search");
    const rows = await prisma.scenario.findMany({
      where: { ...(kind ? { kind } : {}), ...(type ? { type } : {}), ...(search ? { title: { contains: search, mode: "insensitive" } } : {}) },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, kind: true, type: true, title: true, description: true, exposure: true, hidden: true, techniques: true, createdAt: true, updatedAt: true,
        cohorts: { select: { cohort: { select: { id: true, name: true } } } },
        lab: { select: { slug: true, versions: { orderBy: { version: "desc" }, take: 1, select: { version: true, draft: true } } } },
        _count: { select: { submissions: true } },
      },
    });
    return {
      scenarios: rows.map((s) => ({
        id: s.id, kind: s.kind, type: s.type, title: s.title, description: clip(s.description, 200),
        exposure: s.exposure, hidden: s.hidden, techniques: s.techniques,
        releasedTo: s.cohorts.map((c) => c.cohort), submissions: s._count.submissions,
        lab: s.lab ? { slug: s.lab.slug, latestVersion: s.lab.versions[0]?.version ?? null, draft: s.lab.versions[0]?.draft ?? null } : undefined,
        createdAt: iso(s.createdAt), updatedAt: iso(s.updatedAt),
      })),
    };
  },
};

const getScenario: Tool = {
  name: "get_scenario",
  title: "Get a scenario",
  description: "One scenario in full: brief, objectives, flags with their answers, report settings, ATT&CK techniques, cohorts it's released to, and a summary of its data (log and alert counts, endpoints, guide). For a lab, also its slug, versions, parameters, checks, scripts and files. Read the data itself with get_scenario_data, and a lab's lab.yaml with get_lab.",
  inputSchema: { type: "object", properties: { scenario_id: { type: "string" } }, required: ["scenario_id"] },
  annotations: { readOnlyHint: true },
  run: async (args) => {
    const id = argStr(args, "scenario_id", true);
    const s = await prisma.scenario.findUnique({
      where: { id },
      include: {
        endpoints: { orderBy: { hostname: "asc" } },
        cohorts: { select: { cohort: { select: { id: true, name: true } } } },
        lab: {
          include: {
            versions: { orderBy: { version: "desc" }, select: { version: true, draft: true, createdAt: true, definition: true, gate: true } },
            scripts: { orderBy: { name: "asc" }, select: { name: true, content: true, updatedAt: true } },
            files: { orderBy: { name: "asc" }, select: { name: true, filename: true, size: true, updatedAt: true } },
          },
        },
        _count: { select: { submissions: true } },
      },
    });
    if (!s) throw new ToolError("No scenario with that id.");
    const logs = s.logs as { entries?: unknown[] } | null;
    const alerts = s.alerts as { alerts?: unknown[] } | null;
    const base = await getBaseUrl();
    const out: Record<string, unknown> = {
      id: s.id, kind: s.kind, type: s.type, title: s.title, description: s.description,
      exposure: s.exposure, hidden: s.hidden, realtime: s.realtime, techniques: s.techniques,
      adminUrl: `${base}/admin/scenarios/${s.id}`,
      brief: s.brief,
      objectives: s.objectives ?? [],
      flags: s.flags ?? [],
      report: { required: s.reportRequired, prompt: s.reportPrompt },
      releasedTo: s.cohorts.map((c) => c.cohort),
      submissions: s._count.submissions,
      createdAt: iso(s.createdAt), updatedAt: iso(s.updatedAt),
    };
    if (s.kind === "SOC") {
      out.data = {
        logEntries: logs?.entries?.length ?? 0,
        alerts: alerts?.alerts?.length ?? 0,
        guide: s.guide ? { chars: s.guide.length, prompts: Array.isArray(s.guidePrompts) ? s.guidePrompts.length : 0, assets: Array.isArray(s.guideAssets) ? s.guideAssets.length : 0 } : null,
        endpoints: s.endpoints.map((e) => ({ hostname: e.hostname, edr: e.edr != null, osquery: e.osquery != null, artifact: e.artifactName ? { name: e.artifactName, size: e.artifactSize } : null })),
      };
    }
    if (s.lab) {
      const latest = s.lab.versions[0];
      const def = latest?.definition as unknown as CompiledLab | undefined;
      out.lab = {
        id: s.lab.id,
        slug: s.lab.slug,
        versions: s.lab.versions.map((v) => {
          const gate = v.gate as { good?: { score?: number; maxScore?: number } } | null;
          return { version: v.version, draft: v.draft, createdAt: iso(v.createdAt), reference: gate?.good ? `${gate.good.score}/${gate.good.maxScore}` : null };
        }),
        latest: def
          ? {
              maxScore: def.maxScore,
              machines: Object.keys(def.machines ?? {}),
              params: def.params,
              checks: def.checks.map((c) => ({ id: c.id, title: c.title, points: c.points, visibility: c.visibility, flag: c.flag })),
            }
          : null,
        scripts: s.lab.scripts.map((x) => ({ name: x.name, bytes: x.content.length, inBrief: briefScriptNames(s.brief).includes(x.name), files: scriptFileNames(x.content), updatedAt: iso(x.updatedAt) })),
        files: s.lab.files.map((f) => ({ name: f.name, filename: f.filename, size: f.size, updatedAt: iso(f.updatedAt) })),
      };
    }
    return out;
  },
};

const getScenarioData: Tool = {
  name: "get_scenario_data",
  title: "Read a SOC scenario's data",
  description:
    "Page through a SOC scenario's data. source: logs (SIEM log entries), alerts, edr or osquery (one endpoint's bundle; give hostname), or guide (the teaching guide's markdown and its prompts with answers). `search` keeps only items whose JSON contains the text (case-insensitive). Lists are paged with offset/limit (limit up to 500).",
  inputSchema: {
    type: "object",
    properties: {
      scenario_id: { type: "string" },
      source: { type: "string", enum: ["logs", "alerts", "edr", "osquery", "guide"] },
      hostname: { type: "string", description: "Endpoint hostname, for edr and osquery." },
      search: { type: "string" },
      offset: { type: "number", default: 0 },
      limit: { type: "number", default: 50 },
    },
    required: ["scenario_id", "source"],
  },
  annotations: { readOnlyHint: true },
  run: async (args) => {
    const id = argStr(args, "scenario_id", true);
    const source = argEnum(args, "source", ["logs", "alerts", "edr", "osquery", "guide"] as const)!;
    const offset = argNum(args, "offset", 0)!;
    const limit = argNum(args, "limit", 50)!;
    const search = argStr(args, "search")?.toLowerCase();
    const s = await prisma.scenario.findUnique({ where: { id }, select: { kind: true, logs: true, alerts: true, guide: true, guidePrompts: true } });
    if (!s) throw new ToolError("No scenario with that id.");
    if (s.kind !== "SOC") throw new ToolError("That's a lab: it has no SIEM data. Use get_lab for its lab.yaml, scripts and files.");

    if (source === "guide") return { guide: s.guide, prompts: s.guidePrompts ?? [] };

    let items: unknown[];
    if (source === "logs") items = (s.logs as { entries?: unknown[] } | null)?.entries ?? [];
    else if (source === "alerts") items = (s.alerts as { alerts?: unknown[] } | null)?.alerts ?? [];
    else {
      const hostname = argStr(args, "hostname");
      const endpoints = await prisma.scenarioEndpoint.findMany({ where: { scenarioId: id }, select: { hostname: true, edr: true, osquery: true } });
      const ep = endpoints.find((e) => e.hostname.toLowerCase() === hostname?.toLowerCase());
      if (!ep) throw new ToolError(`Give \`hostname\`: one of ${endpoints.map((e) => e.hostname).join(", ") || "(this scenario has no endpoints)"}.`);
      const bundle = (source === "edr" ? ep.edr : ep.osquery) as Record<string, unknown> | null;
      if (!bundle) return { hostname: ep.hostname, source, data: null };
      // Bundles are objects of lists: page each list the same way.
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(bundle)) {
        out[k] = Array.isArray(v) ? page(search ? v.filter((x) => JSON.stringify(x).toLowerCase().includes(search)) : v, offset, limit) : v;
      }
      return { hostname: ep.hostname, source, data: out };
    }
    const kept = search ? items.filter((x) => JSON.stringify(x).toLowerCase().includes(search)) : items;
    return { source, ...(search ? { matched: kept.length, of: items.length } : {}), ...page(kept, offset, limit) };
  },
};

const getLab: Tool = {
  name: "get_lab",
  title: "Get a lab",
  description: "A lab's source: the lab.yaml of a version (latest by default), its compiled checks and parameters, the reference gate result, its assets, and its scripts with their full content and files. Give scenario_id or slug.",
  inputSchema: {
    type: "object",
    properties: { scenario_id: { type: "string" }, slug: { type: "string" }, version: { type: "number", description: "Defaults to the latest." } },
  },
  annotations: { readOnlyHint: true },
  run: async (args) => {
    const found = await findLab(args);
    const want = argNum(args, "version");
    const v = await prisma.labVersion.findFirst({
      where: { labId: found.id, ...(want ? { version: want } : {}) },
      orderBy: { version: "desc" },
    });
    if (!v) throw new ToolError(want ? `This lab has no version ${want}.` : "This lab has no versions.");
    const [scripts, files] = await Promise.all([
      prisma.labScript.findMany({ where: { labId: found.id }, orderBy: { name: "asc" }, select: { name: true, content: true } }),
      prisma.labFile.findMany({ where: { labId: found.id }, orderBy: { name: "asc" }, select: { name: true, filename: true, size: true, contentType: true } }),
    ]);
    const def = v.definition as unknown as CompiledLab;
    return {
      scenarioId: found.scenario.id, title: found.scenario.title, type: found.scenario.type, slug: found.slug,
      version: v.version, draft: v.draft, createdAt: iso(v.createdAt),
      labYaml: v.source,
      compiled: { maxScore: def.maxScore, machines: def.machines, params: def.params, session: def.session, checks: def.checks },
      gate: v.gate,
      assets: v.assets,
      brief: found.scenario.brief,
      scripts: scripts.map((s) => ({ ...s, files: scriptFileNames(s.content), inBrief: briefScriptNames(found.scenario.brief).includes(s.name) })),
      files,
    };
  },
};

const listCohorts: Tool = {
  name: "list_cohorts",
  title: "List cohorts",
  description: "Every cohort with its student count and the scenarios released to it.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: true },
  run: async () => {
    const cohorts = await prisma.cohort.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, zaioBootcampId: true, createdAt: true, _count: { select: { students: true } }, scenarios: { select: { scenario: { select: { id: true, title: true, kind: true, type: true } } } } },
    });
    return { cohorts: cohorts.map((c) => ({ id: c.id, name: c.name, zaioBootcampId: c.zaioBootcampId, students: c._count.students, scenarios: c.scenarios.map((b) => b.scenario), createdAt: iso(c.createdAt) })) };
  },
};

const getCohort: Tool = {
  name: "get_cohort",
  title: "Get a cohort",
  description: "A cohort's students (name, email, student number) and the scenarios released to it.",
  inputSchema: { type: "object", properties: { cohort_id: { type: "string" } }, required: ["cohort_id"] },
  annotations: { readOnlyHint: true },
  run: async (args) => {
    const c = await prisma.cohort.findUnique({
      where: { id: argStr(args, "cohort_id", true) },
      include: {
        students: { orderBy: { name: "asc" }, select: { id: true, name: true, email: true, studentNumber: true, createdAt: true } },
        scenarios: { select: { scenario: { select: { id: true, title: true, kind: true, type: true } } } },
      },
    });
    if (!c) throw new ToolError("No cohort with that id.");
    return { id: c.id, name: c.name, students: c.students.map((s) => ({ ...s, createdAt: iso(s.createdAt) })), scenarios: c.scenarios.map((b) => b.scenario) };
  },
};

const listLabSessionsTool: Tool = {
  name: "list_lab_sessions",
  title: "List lab sessions",
  description: "A lab's sessions, newest first: student, version, status, score (and any override), flags raised and number of check runs. Give scenario_id or slug.",
  inputSchema: {
    type: "object",
    properties: {
      scenario_id: { type: "string" },
      slug: { type: "string" },
      status: { type: "string", enum: ["PREPARING", "ACTIVE", "ENDING", "ENDED", "ABORTED", "EXPIRED"] },
      student: { type: "string", description: "Part of the student's name or email." },
      offset: { type: "number", default: 0 },
      limit: { type: "number", default: 100 },
    },
  },
  annotations: { readOnlyHint: true },
  run: async (args) => {
    const found = await findLab(args);
    const status = argStr(args, "status")?.toUpperCase();
    const student = argStr(args, "student")?.toLowerCase();
    const rows = (await listLabSessions(found.id)).filter(
      (r) => (!status || r.status === status) && (!student || r.student.toLowerCase().includes(student) || r.email.toLowerCase().includes(student)),
    );
    return { lab: { scenarioId: found.scenario.id, slug: found.slug, title: found.scenario.title }, ...page(rows, argNum(args, "offset", 0)!, argNum(args, "limit", 100)!) };
  },
};

const getLabSession: Tool = {
  name: "get_lab_session",
  title: "Get a lab session",
  description: "One lab session in full: the student, their parameter values, machines, every check run with per-check results (including instructor-only evaluation notes), any score override, and the audit trail. Raw evidence is large, so it's left out unless include_evidence is true.",
  inputSchema: { type: "object", properties: { session_id: { type: "string" }, include_evidence: { type: "boolean", default: false } }, required: ["session_id"] },
  annotations: { readOnlyHint: true },
  run: async (args) => {
    const detail = await getSessionDetail(argStr(args, "session_id", true));
    if (!detail) throw new ToolError("No lab session with that id.");
    if (argBool(args, "include_evidence")) return detail;
    return { ...detail, runs: detail.runs.map((r) => ({ ...r, evidence: undefined })) };
  },
};

/* ── grading ─────────────────────────────────────────────────────────────────── */

const listSubmissions: Tool = {
  name: "list_submissions",
  title: "List submissions",
  description:
    "The grading queue, newest first. status: needs_grading (default: submitted, not graded yet), held (graded but not released to the student), released, graded (held or released), or all. Each item has the suggested auto-grade (from flag answers, or a lab session's final score), its basis, and the start of the report. Filter by scenario, cohort or student (id, email, name or student number).",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["needs_grading", "held", "released", "graded", "all"], default: "needs_grading" },
      scenario_id: { type: "string" },
      cohort_id: { type: "string" },
      student: { type: "string" },
      limit: { type: "number", default: 50, description: "Up to 500." },
    },
  },
  annotations: { readOnlyHint: true },
  run: async (args) => {
    const limit = Math.max(1, Math.min(500, argNum(args, "limit", 50)!));
    const where = submissionWhere(args);
    const [items, total] = await Promise.all([getGradingQueue(where, limit), prisma.submission.count({ where })]);
    return { total, shown: items.length, submissions: items.map(summary) };
  },
};

const getSubmission: Tool = {
  name: "get_submission",
  title: "Get a submission",
  description:
    "One submission in full: the student's typed report, every flag question with the student's answer, the right answer and whether it's correct, the suggested auto-grade, and the current grade, feedback and release state. An uploaded report is included: a .docx as its text, a PDF as the document itself. For a lab submission, see get_lab_session for the check results.",
  inputSchema: { type: "object", properties: { submission_id: { type: "string" } }, required: ["submission_id"] },
  annotations: { readOnlyHint: true },
  run: async (args) => {
    const id = argStr(args, "submission_id", true);
    const [item] = await getGradingQueue({ id }, 1);
    if (!item) throw new ToolError("No submission with that id.");
    const sub = await prisma.submission.findUnique({ where: { id }, select: { reportFileKey: true, reportFileName: true, reportFileType: true, flagAnswers: true, scenario: { select: { flags: true } } } });
    const flagAnswers = (sub?.flagAnswers ?? {}) as Record<string, string>;
    const flags = (Array.isArray(sub?.scenario.flags) ? sub.scenario.flags : []) as { id?: string; answer?: string }[];
    const out = {
      ...item,
      flagReview: item.flagReview.map((f, i) => ({ ...f, expected: flags[i]?.answer ?? "", given: flagAnswers[String(flags[i]?.id ?? `f${i + 1}`)] ?? "" })),
      reportFile: sub?.reportFileKey ? { name: sub.reportFileName, type: sub.reportFileType } : null,
    };
    if (!sub?.reportFileKey) return out;

    let bytes: Uint8Array;
    try {
      const { stream } = await getObjectStream(sub.reportFileKey);
      bytes = new Uint8Array(await new Response(stream as ReadableStream).arrayBuffer());
    } catch (e) {
      return { ...out, reportFileError: `Couldn't read the uploaded report from storage: ${e instanceof Error ? e.message : e}` };
    }
    const name = (sub.reportFileName ?? "").toLowerCase();
    if (name.endsWith(".docx")) {
      const text = docxText(bytes);
      return { ...out, reportFileText: text ?? "(couldn't read text from this .docx)" };
    }
    if (name.endsWith(".pdf") || sub.reportFileType === "application/pdf") {
      return new ToolContent([
        { type: "text", text: JSON.stringify(out, null, 1) },
        { type: "resource", resource: { uri: `athena://submissions/${id}/report.pdf`, mimeType: "application/pdf", blob: Buffer.from(bytes).toString("base64") } },
      ]);
    }
    return { ...out, reportFileNote: "This file type can't be shown here: open the submission in Athena to read it." };
  },
};

const gradeSubmission: Tool = {
  name: "grade_submission",
  title: "Grade a submission",
  description:
    "Commit a grade (0–100) and feedback for a submission. This locks the submission so the student can't change it. The grade stays HELD (hidden from the student) unless release is true; release later with set_grades_released. Re-grading a released submission keeps it released. Look at get_submission first: the auto-grade is a suggestion, not a verdict.",
  inputSchema: {
    type: "object",
    properties: {
      submission_id: { type: "string" },
      grade: { type: "number", minimum: 0, maximum: 100 },
      feedback: { type: "string", description: "Shown to the student once released. Markdown is fine." },
      release: { type: "boolean", default: false },
    },
    required: ["submission_id", "grade"],
  },
  annotations: { destructiveHint: false, idempotentHint: true },
  run: async (args, actor) => {
    const id = argStr(args, "submission_id", true);
    const grade = argNum(args, "grade");
    if (grade == null) throw new ToolError("`grade` is required.");
    const release = argBool(args, "release");
    afterGrading(await gradeSubmissionAs(actor.id, id, grade, argStr(args, "feedback") ?? "", release));
    return { ok: true, submissionId: id, grade: Math.round(grade), released: release ? true : "unchanged (held unless it was already released)" };
  },
};

const setGradesReleased: Tool = {
  name: "set_grades_released",
  title: "Release or hold grades",
  description: "Release graded submissions to their students (released: true), or hide them again (released: false). Each submission must already have a committed grade to be released.",
  inputSchema: {
    type: "object",
    properties: { submission_ids: { type: "array", items: { type: "string" }, minItems: 1 }, released: { type: "boolean", default: true } },
    required: ["submission_ids"],
  },
  annotations: { idempotentHint: true },
  run: async (args) => {
    const ids = argStrList(args, "submission_ids") ?? [];
    if (!ids.length) throw new ToolError("`submission_ids` is required.");
    const released = argBool(args, "released", true);
    const results = [];
    for (const id of ids) {
      const res = await setGradeReleasedAs(id, released);
      if (res.cohortId) revalidatePath(`/admin/cohorts/${res.cohortId}`);
      results.push({ submissionId: id, ok: Boolean(res.ok), error: res.error });
    }
    revalidatePath("/admin/grading");
    return { released, changed: results.filter((r) => r.ok).length, results };
  },
};

const setSubmissionCommitted: Tool = {
  name: "set_submission_committed",
  title: "Lock or re-open a submission",
  description: "committed: true locks a submission for grading (the student can't change it); false re-opens it so the student can redo it. A released grade must be un-released before re-opening.",
  inputSchema: { type: "object", properties: { submission_id: { type: "string" }, committed: { type: "boolean" } }, required: ["submission_id", "committed"] },
  annotations: { idempotentHint: true },
  run: async (args, actor) => {
    const id = argStr(args, "submission_id", true);
    const committed = argBool(args, "committed");
    afterGrading(await setSubmissionCommittedAs(actor.id, id, committed));
    return { ok: true, submissionId: id, committed };
  },
};

const overrideLabScore: Tool = {
  name: "override_lab_score",
  title: "Adjust a lab session's score",
  description: "Set an instructor override of a finished lab session's score (a whole number from 0 to its max score), with a reason that's kept with the session and audited. score: null clears the override. The lab submission's auto-grade follows the adjusted score.",
  inputSchema: {
    type: "object",
    properties: { session_id: { type: "string" }, score: { type: ["number", "null"] }, reason: { type: "string" } },
    required: ["session_id", "score"],
  },
  annotations: { idempotentHint: true },
  run: async (args, actor) => {
    const sessionId = argStr(args, "session_id", true);
    const score = args.score === null ? null : argNum(args, "score");
    if (score === undefined) throw new ToolError("`score` is required (a number, or null to clear the override).");
    await lab(() => setScoreOverride(sessionId, score, argStr(args, "reason") ?? "", actor.id));
    const s = await prisma.labSession.findUnique({ where: { id: sessionId }, select: { labVersion: { select: { lab: { select: { scenarioId: true } } } } } });
    if (s) revalidatePath(`/admin/scenarios/${s.labVersion.lab.scenarioId}`);
    revalidatePath("/admin/grading");
    return { ok: true, sessionId, overrideScore: score };
  },
};

const regradeSchema = {
  type: "object",
  properties: {
    scenario_id: { type: "string" },
    slug: { type: "string" },
    target: { type: "string", enum: ["own", "latest"], description: "own: re-run each session's final evidence through its own version's checks; latest: through the latest version's checks." },
    session_ids: { type: "array", items: { type: "string" }, description: "Only these sessions (default: every finished session)." },
  },
  required: ["target"],
};

const previewLabRegrade: Tool = {
  name: "preview_lab_regrade",
  title: "Preview a lab re-grade",
  description: "Re-grade finished lab sessions from their stored evidence without saving anything, and show each session's old and new score. Give scenario_id or slug. Run apply_lab_regrade to save it.",
  inputSchema: regradeSchema,
  annotations: { readOnlyHint: true },
  run: async (args) => {
    const found = await findLab(args);
    const target = argEnum(args, "target", ["own", "latest"] as const, "own") as RegradeTarget;
    const diffs = await lab(() => previewRegrade(found.id, target, argStrList(args, "session_ids")));
    return { lab: found.slug, target, sessions: diffs };
  },
};

const applyLabRegrade: Tool = {
  name: "apply_lab_regrade",
  title: "Apply a lab re-grade",
  description: "Re-grade finished lab sessions from their stored evidence and save the new scores (audited). Preview it first with preview_lab_regrade. Overrides are kept.",
  inputSchema: regradeSchema,
  annotations: { destructiveHint: false },
  run: async (args, actor) => {
    const found = await findLab(args);
    const target = argEnum(args, "target", ["own", "latest"] as const, "own") as RegradeTarget;
    const changed = await lab(() => applyRegrade(found.id, target, argStrList(args, "session_ids"), actor.id));
    revalidatePath(`/admin/scenarios/${found.scenario.id}`);
    revalidatePath("/admin/grading");
    return { ok: true, lab: found.slug, target, changed };
  },
};

/* ── building ────────────────────────────────────────────────────────────────── */

function bundleFromFiles(list: unknown): BundleEntry[] {
  if (!Array.isArray(list)) throw new ToolError("`files` must be a list of { path, content, encoding? }.");
  return list.map((f, i) => {
    const { path, content, encoding } = (f ?? {}) as { path?: unknown; content?: unknown; encoding?: unknown };
    if (typeof path !== "string" || typeof content !== "string") throw new ToolError(`files[${i}] needs a string \`path\` and \`content\`.`);
    const parts = path.replace(/\\/g, "/").split("/").filter((p) => p && p !== ".");
    if (!parts.length || parts.includes("..")) throw new ToolError(`files[${i}]: "${path}" isn't a path inside the bundle.`);
    const bytes = encoding === "base64" ? Buffer.from(content, "base64") : Buffer.from(content, "utf8");
    return { rel: parts.join("/"), file: new File([new Uint8Array(bytes)], parts[parts.length - 1]) };
  });
}

const autobuild: Tool = {
  name: "autobuild",
  title: "Build from a bundle (auto-builder)",
  description: [
    "Upload a bundle to the auto-builder, exactly like dropping its folder on the Auto-builder page.",
    "A bundle is a folder whose scenario.json says what to build:",
    "• SOC Dojo or Assessment: scenario.json with title, type (DOJO or ASSESSMENT), brief, flags, logs/alerts bundles, endpoints, guide (docs/autobuild.md). This always creates a NEW scenario.",
    '• Lab Dojo or Assessment: scenario.json with "kind": "LAB" and type, plus brief.md, lab/lab.yaml, lab/reference/*.json, scripts/ (docs/labs/building-labs.md). A lab whose slug exists gets a new version.',
    "Send it one of two ways: zip_base64, a base64 .zip whose root holds the bundle's folder (my-bundle/scenario.json, …); or files, a list of { path, content, encoding } with paths relative to the bundle folder (scenario.json, lab/lab.yaml, …; encoding 'base64' for binary files, default utf8).",
    "For big bundles, POST the zip to /api/mcp/autobuild instead (see the server instructions).",
    "Set dry_run: true to validate without saving anything. Errors and, for labs, the full check report come back in the result.",
  ].join("\n"),
  inputSchema: {
    type: "object",
    properties: {
      zip_base64: { type: "string", description: "A .zip of the bundle folder, base64-encoded." },
      files: {
        type: "array",
        items: {
          type: "object",
          properties: { path: { type: "string" }, content: { type: "string" }, encoding: { type: "string", enum: ["utf8", "base64"], default: "utf8" } },
          required: ["path", "content"],
        },
      },
      dry_run: { type: "boolean", default: false },
    },
  },
  annotations: { destructiveHint: false, idempotentHint: false },
  run: async (args, actor) => {
    const zip = argStr(args, "zip_base64");
    if (!zip && args.files == null) throw new ToolError("Give `zip_base64` or `files`.");
    let entries: BundleEntry[];
    if (zip) {
      const bytes = Buffer.from(zip.replace(/^data:[^,]*,/, ""), "base64");
      if (bytes.length > MAX_BUNDLE_BYTES) throw new ToolError("The zip is over 95 MB.");
      try {
        entries = bundleFromZip(bytes);
      } catch (e) {
        throw new ToolError(`That isn't a readable zip: ${e instanceof Error ? e.message : e}`);
      }
    } else {
      entries = bundleFromFiles(args.files);
    }
    return autoBuildResult(await autoBuildBundle(entries, actor.id, { dryRun: argBool(args, "dry_run") }));
  },
};

/** An auto-build result for a client, with links; a failed build is a tool error carrying the report. */
export async function autoBuildResult(res: Awaited<ReturnType<typeof autoBuildBundle>>) {
  const base = await getBaseUrl();
  const out = { ...res, adminUrl: res.scenarioId ? `${base}/admin/scenarios/${res.scenarioId}` : undefined };
  if (res.error) throw new ToolError(JSON.stringify(out, null, 1));
  return out;
}

export const TOOLS: Tool[] = [
  whoami,
  listScenarios,
  getScenario,
  getScenarioData,
  getLab,
  listCohorts,
  getCohort,
  listLabSessionsTool,
  getLabSession,
  listSubmissions,
  getSubmission,
  gradeSubmission,
  setGradesReleased,
  setSubmissionCommitted,
  overrideLabScore,
  previewLabRegrade,
  applyLabRegrade,
  autobuild,
];
