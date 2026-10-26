import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { AgentTask, LabCheckRun, LabSession, Machine } from "@/generated/prisma/client";
import { signBundle } from "./bundle-signing";
import { gradeLab, type GradeResult } from "./language/grade";
import { lockdownFlags, type Evidence, type ItemResult, type LockdownStatus, type RoleEvidence } from "./language/evidence";
import type { ParamValues } from "./language/params";
import { renderTemplate, type TemplateValues } from "./language/template";
import type { CompiledLab, GatherEntry, GatherItem } from "./language/types";
import { getOrCreateLabParams } from "./params-store";
import { notifyMachine } from "./task-events";

/**
 * Lab sessions (docs/labs/spec.md section 8): start (baseline on every
 * machine) → practice checks → end (final check, grade, submission).
 * Work for machines goes through signed AgentTask bundles; agents report
 * back through submitTaskResult. Everything time-based (expired tasks,
 * deadlines) is resolved lazily by `settle`, which every entry point calls.
 */

/** Where the agent stores downloaded assets; {{asset.x}} renders to a path below it. */
export const AGENT_ASSET_DIR = "/var/lib/zaio/assets";
/** An agent must pick a task up within this time… */
const TASK_PICKUP_MS = 10 * 60 * 1000;
/** …and report its result within this time of picking it up. */
const TASK_RUN_MS = 6 * 60 * 1000;
/** After the deadline, the final check is triggered; this much slack before the session expires. */
const DEADLINE_GRACE_MS = 30 * 60 * 1000;
/** Agents undo a lockdown on their own this long after the deadline (after the final check had its chance). */
const UNDO_SAFETY_MS = DEADLINE_GRACE_MS + 15 * 60 * 1000;
const AUTH_LOG = "/var/log/auth.log";
const MAX_ITEM_TEXT = 256 * 1024;

export const ACTIVE_STATUSES = ["PREPARING", "ACTIVE", "ENDING"] as const;

export type LabAsset = { name: string; file: string; size: number; sha256: string; storageKey: string };

export class LabError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export const assetPath = (a: Pick<LabAsset, "sha256" | "file">) => `${AGENT_ASSET_DIR}/${a.sha256}/${a.file.split("/").pop()}`;

// ── Access ──────────────────────────────────────────────────────────────────

/** The lab behind a scenario, if the user may run it (released to them, or an instructor). */
export async function loadLabForUser(userId: string, ref: { scenarioId?: string; slug?: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, cohortId: true } });
  if (!user) throw new LabError("not_found", "No such user.", 404);
  const lab = await prisma.lab.findFirst({
    where: ref.slug ? { slug: ref.slug } : { scenarioId: ref.scenarioId },
    include: {
      scenario: true,
      // Instructors run the newest version, drafts included (that's how a draft gets its
      // good reference); students only ever get the newest accepted one.
      versions: { where: user.role === "SUPER_ADMIN" ? {} : { draft: false }, orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!lab || lab.scenario.kind !== "LAB") throw new LabError("not_found", "No such lab.", 404);
  const version = lab.versions[0];
  if (!version) throw new LabError("not_found", "This lab has no published version yet.", 404);

  if (user.role !== "SUPER_ADMIN" && lab.scenario.exposure !== "PUBLIC") {
    const bound = user.cohortId
      ? await prisma.cohortScenario.findUnique({ where: { cohortId_scenarioId: { cohortId: user.cohortId, scenarioId: lab.scenarioId } } })
      : null;
    if (!bound) throw new LabError("forbidden", "This lab hasn't been released to you.", 403);
  }
  return { lab, scenario: lab.scenario, version, definition: version.definition as unknown as CompiledLab };
}

// ── Bundles ─────────────────────────────────────────────────────────────────

type TaskPayload = Record<string, unknown>;

async function queueTask(
  args: { machine: Machine; session: LabSession & { labVersion: { version: number; lab: { slug: string } } }; kind: "BASELINE" | "COLLECT" | "UNDO"; role: string; checkRunId?: string },
  payload: TaskPayload,
): Promise<AgentTask> {
  const id = `t_${randomBytes(12).toString("base64url")}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TASK_PICKUP_MS + TASK_RUN_MS);
  const bundle = {
    format: 1,
    taskId: id,
    kind: args.kind,
    machineId: args.machine.id,
    sessionId: args.session.id,
    role: args.role,
    lab: { slug: args.session.labVersion.lab.slug, version: args.session.labVersion.version },
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ...payload,
  };
  const { bytes, signature, keyId } = await signBundle(bundle);
  const task = await prisma.agentTask.create({
    data: {
      id, machineId: args.machine.id, sessionId: args.session.id, checkRunId: args.checkRunId ?? null, role: args.role,
      kind: args.kind, bundle: new Uint8Array(bytes), signature, keyId, expiresAt,
    },
  });
  notifyMachine(args.machine.id);
  return task;
}

/** Everything the baseline for one role must cover: declared paths plus every file/glob/log the lab collects. */
function baselinePlan(lab: CompiledLab, role: string, values: TemplateValues) {
  const declared = lab.lifecycle.baseline[role] ?? { hash: [], logs: [] };
  const hash = new Set(declared.hash);
  const logs = new Set(declared.logs);
  for (const step of lab.collect.filter((s) => s.on === role)) {
    for (const { item } of step.gather) {
      if (item.kind === "file") hash.add(item.path);
      if (item.kind === "glob") hash.add(item.pattern);
      if (item.kind === "log") logs.add(item.path);
    }
  }
  // Lockdown: SSH logins after the baseline are found from this offset.
  if (lab.lifecycle.lockdown) logs.add(AUTH_LOG);
  return {
    hash: [...hash].map((p) => renderTemplate(p, values)),
    logs: [...logs].map((p) => renderTemplate(p, values)),
  };
}

function renderItem(item: GatherItem, values: TemplateValues): GatherItem {
  const r = (s: string) => renderTemplate(s, values);
  switch (item.kind) {
    case "file": return { ...item, path: r(item.path) };
    case "glob": return { ...item, pattern: r(item.pattern) };
    case "log": return { ...item, path: r(item.path) };
    case "run": return { ...item, argv: item.argv.map(r), ...(item.stdin !== undefined ? { stdin: r(item.stdin) } : {}), ...(item.cwd !== undefined ? { cwd: r(item.cwd) } : {}) };
    default: return item;
  }
}

function collectPlan(lab: CompiledLab, role: string, run: "practice" | "final", values: TemplateValues, assets: LabAsset[]) {
  const steps = lab.collect
    .filter((s) => s.on === role && (s.when === "always" || s.when === run))
    .map((s) => ({ gather: s.gather.map(({ name, item }): GatherEntry => ({ name, item: renderItem(item, values) })) }));
  const text = JSON.stringify(lab.collect.filter((s) => s.on === role));
  const needed = assets.filter((a) => text.includes(`{{asset.${a.name}}}`));
  return {
    run,
    steps,
    // Lockdown labs: the agent also reports whether SSH stayed off.
    lockdown: lab.lifecycle.lockdown,
    assets: needed.map((a) => ({ name: a.name, sha256: a.sha256, size: a.size, path: assetPath(a), url: `/api/agent/assets/${a.sha256}` })),
  };
}

type SessionCtx = Awaited<ReturnType<typeof loadSessionCtx>>;

async function loadSessionCtx(sessionId: string) {
  const session = await prisma.labSession.findUnique({
    where: { id: sessionId },
    include: {
      labVersion: { include: { lab: { include: { scenario: true } } } },
      machines: { include: { machine: true } },
    },
  });
  if (!session) throw new LabError("not_found", "No such session.", 404);
  const lab = session.labVersion.definition as unknown as CompiledLab;
  const assets = session.labVersion.assets as unknown as LabAsset[];
  const params = (await prisma.labParam.findUnique({ where: { labId_userId: { labId: session.labVersion.labId, userId: session.userId } } }))?.values as ParamValues ?? {};
  const values: TemplateValues = {
    param: params,
    asset: Object.fromEntries(assets.map((a) => [a.name, assetPath(a)])),
    session: { nonce: session.nonce, id: session.id },
    machine: Object.fromEntries(session.machines.map((m) => [m.role, { hostname: m.machine.hostname }])),
  };
  return { session, lab, assets, params, values };
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

export type StartInput = { userId: string; scenarioId?: string; slug?: string; assignments: Record<string, string> };

export async function startSession(input: StartInput): Promise<LabSession> {
  const { lab, scenario, version, definition } = await loadLabForUser(input.userId, input);
  await settleUserSessions(input.userId);

  const running = await prisma.labSession.findFirst({
    where: { userId: input.userId, status: { in: [...ACTIVE_STATUSES] }, labVersion: { labId: lab.id } },
  });
  if (running) throw new LabError("session_running", "You already have a session running for this lab. Finish or cancel it first.", 409);

  if (scenario.type === "ASSESSMENT") {
    const sub = await prisma.submission.findUnique({ where: { scenarioId_studentId: { scenarioId: scenario.id, studentId: input.userId } } });
    if (sub?.committedAt) throw new LabError("committed", "Your instructor has locked this assessment for grading.", 409);
  }

  // Role → machine: each role filled by one of the user's active machines, no machine twice.
  const roles = Object.keys(definition.machines);
  const machines: Record<string, Machine> = {};
  const used = new Set<string>();
  for (const role of roles) {
    const id = input.assignments[role];
    if (!id) throw new LabError("role_unassigned", `Choose a machine for the "${role}" role.`);
    if (used.has(id)) throw new LabError("role_conflict", "Each role needs a different machine.");
    const m = await prisma.machine.findFirst({ where: { id, userId: input.userId, status: "ACTIVE" } });
    if (!m) throw new LabError("machine_unavailable", `The machine chosen for "${role}" isn't one of your linked machines.`);
    const spec = definition.machines[role];
    if (spec.versions.length && !spec.versions.includes(m.osVersion)) {
      throw new LabError("os_unsupported", `"${role}" needs Ubuntu ${spec.versions.join(" or ")}; ${m.label} runs ${m.osVersion}.`);
    }
    const missing = definition.capabilities.filter((c) => !m.capabilities.includes(c));
    if (missing.length) {
      throw new LabError("upgrade_required", `${m.label}'s agent (${m.agentVersion}) can't do ${missing.join(", ")} yet. Update it: curl -fsSL <athena>/i | sudo bash`, 409);
    }
    used.add(id);
    machines[role] = m;
  }

  await getOrCreateLabParams(lab.id, input.userId, definition);
  const now = new Date();
  const session = await prisma.labSession.create({
    data: {
      labVersionId: version.id,
      userId: input.userId,
      nonce: randomBytes(10).toString("hex").toUpperCase(),
      deadlineAt: definition.session.timeLimitMinutes ? new Date(now.getTime() + definition.session.timeLimitMinutes * 60_000) : null,
      machines: { create: roles.map((role) => ({ role, machineId: machines[role].id })) },
    },
  });
  await prisma.scenarioProgress.upsert({
    where: { scenarioId_studentId: { scenarioId: scenario.id, studentId: input.userId } },
    update: {},
    create: { scenarioId: scenario.id, studentId: input.userId },
  });

  const ctx = await loadSessionCtx(session.id);
  for (const role of roles) {
    await queueTask(
      { machine: machines[role], session: ctx.session, kind: "BASELINE", role },
      {
        baseline: baselinePlan(definition, role, ctx.values),
        lockdown: definition.lifecycle.lockdown,
        deadlineAt: session.deadlineAt?.toISOString() ?? null,
        undoAt: session.deadlineAt ? new Date(session.deadlineAt.getTime() + UNDO_SAFETY_MS).toISOString() : null,
      },
    );
  }
  await prisma.labAuditEvent.create({ data: { type: "SESSION_START", userId: input.userId, detail: { sessionId: session.id, lab: lab.slug, version: version.version, machines: Object.fromEntries(roles.map((r) => [r, machines[r].id])) } } });
  return session;
}

/** Queue a check run: practice (student asked) or final (end / deadline). */
export async function requestCheck(sessionId: string, userId: string | null, final: boolean): Promise<LabCheckRun> {
  await settle(sessionId);
  return queueCheck(sessionId, userId, final);
}

async function queueCheck(sessionId: string, userId: string | null, final: boolean): Promise<LabCheckRun> {
  const ctx = await loadSessionCtx(sessionId);
  const { session, lab } = ctx;
  if (userId && session.userId !== userId) throw new LabError("not_found", "No such session.", 404);
  if (session.status === "PREPARING") throw new LabError("not_ready", "The session is still starting: waiting for every machine to take its baseline.", 409);
  if (session.status !== "ACTIVE") throw new LabError("not_active", "This session is no longer running.", 409);

  const runs = await prisma.labCheckRun.findMany({ where: { sessionId }, orderBy: { requestedAt: "desc" } });
  if (!final) {
    const policy = lab.session.checks;
    if (!policy.practice) throw new LabError("no_practice", "This lab has no practice checks — end the session to be graded.", 409);
    if (runs.some((r) => r.status === "COLLECTING")) throw new LabError("check_running", "A check is already running.", 409);
    const practice = runs.filter((r) => !r.final);
    if (practice.length >= policy.maxPractice) throw new LabError("max_checks", `You've used all ${policy.maxPractice} practice checks.`, 429);
    const wait = practice[0] ? practice[0].requestedAt.getTime() + policy.cooldownSeconds * 1000 - Date.now() : 0;
    if (wait > 0) throw new LabError("cooldown", `Wait ${Math.ceil(wait / 1000)}s before the next check.`, 429);
  }

  const run = await prisma.labCheckRun.create({ data: { sessionId, final } });
  if (final) await prisma.labSession.update({ where: { id: sessionId }, data: { status: "ENDING" } });
  for (const sm of session.machines) {
    await queueTask(
      { machine: sm.machine, session, kind: "COLLECT", role: sm.role, checkRunId: run.id },
      collectPlan(lab, sm.role, final ? "final" : "practice", ctx.values, ctx.assets),
    );
  }
  return run;
}

export function endSession(sessionId: string, userId: string | null) {
  return requestCheck(sessionId, userId, true);
}

/** Give up on a session that never got going (or a stuck one). No grade. */
export async function cancelSession(sessionId: string, userId: string): Promise<void> {
  const session = await prisma.labSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new LabError("not_found", "No such session.", 404);
  if (!ACTIVE_STATUSES.includes(session.status as (typeof ACTIVE_STATUSES)[number])) return;
  await prisma.$transaction([
    prisma.agentTask.updateMany({ where: { sessionId, status: { in: ["QUEUED", "DELIVERED"] } }, data: { status: "EXPIRED", error: "session cancelled" } }),
    prisma.labCheckRun.updateMany({ where: { sessionId, status: "COLLECTING" }, data: { status: "FAILED", completedAt: new Date() } }),
    prisma.labSession.update({ where: { id: sessionId }, data: { status: "ABORTED", endedAt: new Date(), note: "Cancelled by the student." } }),
  ]);
  await queueUndo(sessionId);
}

/**
 * When a session closes (ended, cancelled, aborted, expired), ask every machine
 * in it to undo its lockdown. Agents without a journal for the session treat it
 * as a no-op; agents that never get the task undo on their own at undoAt.
 */
async function queueUndo(sessionId: string): Promise<void> {
  const ctx = await loadSessionCtx(sessionId);
  if (!ctx.lab.lifecycle.lockdown) return;
  const already = await prisma.agentTask.findMany({ where: { sessionId, kind: "UNDO" }, select: { machineId: true } });
  for (const sm of ctx.session.machines) {
    if (already.some((t) => t.machineId === sm.machineId)) continue;
    await queueTask({ machine: sm.machine, session: ctx.session, kind: "UNDO", role: sm.role }, {});
  }
}

// ── Results from agents ─────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Keep stored evidence bounded: long text fields are cut (graded the same way the agent cut them). */
function capItems(items: Record<string, unknown>): Record<string, ItemResult> {
  const out: Record<string, ItemResult> = {};
  for (const [name, raw] of Object.entries(items)) {
    if (!isObj(raw) || typeof raw.ok !== "boolean") {
      out[name] = { ok: false, error: "invalid", message: "the agent sent an unreadable result" };
      continue;
    }
    const r = { ...raw } as ItemResult;
    for (const k of ["stdout", "stderr", "content"]) {
      if (typeof r[k] === "string" && (r[k] as string).length > MAX_ITEM_TEXT) {
        r[k] = (r[k] as string).slice(0, MAX_ITEM_TEXT);
        r.truncated = true;
      }
    }
    out[name] = r;
  }
  return out;
}

export async function submitTaskResult(machine: Machine, taskId: string, body: unknown): Promise<{ ok: true } | { ok: false; status: number; error: string; message: string }> {
  const task = await prisma.agentTask.findUnique({ where: { id: taskId } });
  if (!task || task.machineId !== machine.id) return { ok: false, status: 404, error: "not_found", message: "No such task for this machine." };
  if (task.status !== "QUEUED" && task.status !== "DELIVERED") {
    return { ok: false, status: 409, error: "task_closed", message: `This task is already ${task.status.toLowerCase()}.` };
  }
  if (!isObj(body)) return { ok: false, status: 400, error: "bad_request", message: "Result must be a JSON object." };

  const failed = body.ok !== true;
  await prisma.agentTask.update({
    where: { id: task.id },
    data: { status: failed ? "FAILED" : "DONE", completedAt: new Date(), error: failed ? String(body.message ?? body.error ?? "failed").slice(0, 500) : null },
  });

  if (task.kind === "BASELINE" && task.sessionId && task.role) {
    if (!failed) {
      const baseline = {
        lockdown: isObj(body.lockdown) ? body.lockdown : null,
        files: isObj(body.files) ? body.files : {},
        logs: isObj(body.logs) ? body.logs : {},
        bootId: typeof body.bootId === "string" ? body.bootId : null,
        clock: typeof body.clock === "string" ? body.clock : null,
        truncated: body.truncated === true,
        takenAt: new Date().toISOString(),
      };
      await prisma.labSessionMachine.update({ where: { sessionId_role: { sessionId: task.sessionId, role: task.role } }, data: { baseline: baseline as object } });
    }
  }

  if (task.kind === "COLLECT" && task.checkRunId && task.role && !failed) {
    // Merge this role's evidence into the run (each role writes its own key).
    const roleEvidence: RoleEvidence = {
      machine: isObj(body.machine) ? { hostname: String(body.machine.hostname ?? ""), osVersion: String(body.machine.osVersion ?? "") } : undefined,
      items: capItems(isObj(body.items) ? body.items : {}),
      ...(isObj(body.lockdown) ? { lockdown: body.lockdown as LockdownStatus } : {}),
    };
    const run = await prisma.labCheckRun.findUnique({ where: { id: task.checkRunId } });
    const evidence = (run?.evidence ?? { format: 1, roles: {} }) as unknown as Evidence;
    evidence.roles[task.role] = roleEvidence;
    await prisma.labCheckRun.update({ where: { id: task.checkRunId }, data: { evidence: evidence as object } });
  }

  if (task.sessionId) await settle(task.sessionId);
  return { ok: true };
}

// ── Settling: timeouts, completion, grading ─────────────────────────────────

/** Expire overdue tasks, advance session states and grade finished check runs. Idempotent. */
export async function settle(sessionId: string): Promise<void> {
  const now = Date.now();
  await prisma.agentTask.updateMany({
    where: { sessionId, status: "QUEUED", expiresAt: { lt: new Date(now) } },
    data: { status: "EXPIRED", error: "the machine never picked this up (is it on, and is the agent running?)" },
  });
  await prisma.agentTask.updateMany({
    where: { sessionId, status: "DELIVERED", deliveredAt: { lt: new Date(now - TASK_RUN_MS) } },
    data: { status: "EXPIRED", error: "the machine picked this up but never reported back" },
  });

  const session = await prisma.labSession.findUnique({ where: { id: sessionId }, include: { tasks: true, machines: true } });
  if (!session) return;

  if (session.status === "PREPARING") {
    const baselines = session.tasks.filter((t) => t.kind === "BASELINE");
    const bad = baselines.find((t) => t.status === "FAILED" || t.status === "EXPIRED");
    if (bad) {
      const m = session.machines.find((x) => x.role === bad.role);
      await prisma.labSession.update({
        where: { id: sessionId },
        data: { status: "ABORTED", endedAt: new Date(), note: `Couldn't start on the ${m?.role ?? "?"} machine: ${bad.error ?? "unknown error"}` },
      });
      await queueUndo(sessionId); // other machines may already be locked down
      return;
    }
    if (baselines.length && baselines.every((t) => t.status === "DONE")) {
      await prisma.labSession.update({ where: { id: sessionId }, data: { status: "ACTIVE", startedAt: new Date() } });
    }
    return;
  }

  // Grade check runs whose tasks have all resolved.
  const runs = await prisma.labCheckRun.findMany({ where: { sessionId, status: "COLLECTING" } });
  for (const run of runs) {
    const tasks = session.tasks.filter((t) => t.checkRunId === run.id);
    if (tasks.length && tasks.every((t) => t.status !== "QUEUED" && t.status !== "DELIVERED")) await gradeRun(run.id);
  }

  // Past the deadline: end it (final check). Long past: expire.
  const fresh = await prisma.labSession.findUnique({ where: { id: sessionId } });
  if (fresh?.status === "ACTIVE" && fresh.deadlineAt && fresh.deadlineAt.getTime() < now) {
    await queueCheck(sessionId, null, true).catch(() => {});
  } else if (fresh?.status === "ENDING" && fresh.deadlineAt && fresh.deadlineAt.getTime() + DEADLINE_GRACE_MS < now) {
    await prisma.labSession.update({ where: { id: sessionId }, data: { status: "EXPIRED", endedAt: new Date(), note: "Expired: the final check never completed." } });
    await queueUndo(sessionId);
  }
}

/** Settle every open session of a user (cheap: usually zero or one). */
export async function settleUserSessions(userId: string): Promise<void> {
  const open = await prisma.labSession.findMany({ where: { userId, status: { in: [...ACTIVE_STATUSES] } }, select: { id: true } });
  for (const s of open) await settle(s.id);
}

/** Settle sessions that involve a machine (called from its poll). */
export async function settleMachineSessions(machineId: string): Promise<void> {
  const open = await prisma.labSessionMachine.findMany({
    where: { machineId, session: { status: { in: [...ACTIVE_STATUSES] } } },
    select: { sessionId: true },
  });
  for (const s of open) await settle(s.sessionId);
}

/** A run's stored evidence with each machine's baseline attached, ready to grade. */
export function runEvidence(ctx: SessionCtx, run: Pick<LabCheckRun, "evidence">): Evidence {
  const evidence = structuredClone((run.evidence ?? { format: 1, roles: {} }) as unknown as Evidence);
  for (const sm of ctx.session.machines) {
    const b = sm.baseline as { files?: Record<string, string> } | null;
    evidence.roles[sm.role] = { ...(evidence.roles[sm.role] ?? { items: {} }), baseline: { files: b?.files ?? {} } };
  }
  return evidence;
}

/**
 * Grade a stored check run — with the session's own lab version, or another
 * definition (re-grading against a fixed version). Pure apart from reading ctx.
 */
export function gradeStoredRun(ctx: SessionCtx, run: Pick<LabCheckRun, "evidence" | "final">, definition: CompiledLab = ctx.lab): GradeResult {
  const evidence = runEvidence(ctx, run);
  const result = gradeLab(definition, evidence, {
    params: ctx.params,
    session: { nonce: ctx.session.nonce, id: ctx.session.id, startedAt: ctx.session.startedAt?.toISOString() },
    run: run.final ? "final" : "practice",
  });
  // Lockdown reports become instructor flags alongside the lab's own.
  result.flags = [...new Set([...result.flags, ...lockdownFlags(evidence)])];
  return result;
}

export { loadSessionCtx };
export type { SessionCtx };

async function gradeRun(runId: string): Promise<void> {
  // Claim the run so two concurrent settles can't both grade it.
  const claimed = await prisma.labCheckRun.updateMany({ where: { id: runId, status: "COLLECTING" }, data: { status: "GRADED", completedAt: new Date() } });
  if (claimed.count !== 1) return;
  const run = await prisma.labCheckRun.findUniqueOrThrow({ where: { id: runId } });
  const ctx: SessionCtx = await loadSessionCtx(run.sessionId);
  const result = gradeStoredRun(ctx, run);
  const { parsed: _parsed, ...stored } = result;
  void _parsed;
  await prisma.labCheckRun.update({
    where: { id: runId },
    data: { result: stored as object, score: result.score, maxScore: result.maxScore, graderRev: result.graderRev },
  });
  if (run.final) await finishSession(ctx, result);
}

async function finishSession(ctx: SessionCtx, result: GradeResult): Promise<void> {
  const { session } = ctx;
  const scenario = session.labVersion.lab.scenario;
  await prisma.labSession.update({
    where: { id: session.id },
    data: { status: "ENDED", endedAt: new Date(), score: result.score, maxScore: result.maxScore, flags: result.flags },
  });
  if (result.flags.length) {
    await prisma.labAuditEvent.create({ data: { type: "FLAG", userId: session.userId, detail: { sessionId: session.id, flags: result.flags } } });
  }
  if (scenario.type === "ASSESSMENT") {
    // The latest ended session is the submission, until the instructor commits it.
    const existing = await prisma.submission.findUnique({ where: { scenarioId_studentId: { scenarioId: scenario.id, studentId: session.userId } } });
    if (!existing?.committedAt) {
      await prisma.submission.upsert({
        where: { scenarioId_studentId: { scenarioId: scenario.id, studentId: session.userId } },
        update: { labSessionId: session.id, status: "SUBMITTED", submittedAt: new Date(), grade: null, gradedAt: null, gradedById: null, releasedAt: null },
        create: { scenarioId: scenario.id, studentId: session.userId, labSessionId: session.id, status: "SUBMITTED" },
      });
    }
  }
  await prisma.labAuditEvent.create({ data: { type: "SESSION_END", userId: session.userId, detail: { sessionId: session.id, score: result.score, maxScore: result.maxScore } } });
  await queueUndo(session.id);
}

// ── Agent task delivery ─────────────────────────────────────────────────────

export type WireTask = { taskId: string; bundle: string; sig: string; keyId: string };

export const toWire = (t: AgentTask): WireTask => ({ taskId: t.id, bundle: Buffer.from(t.bundle).toString("base64"), sig: t.signature, keyId: t.keyId });

/** Hand queued tasks to a machine (marks them delivered). */
export async function takeTasks(machineId: string, filter: { sessionId?: string } = {}): Promise<WireTask[]> {
  const tasks = await prisma.agentTask.findMany({
    where: { machineId, status: "QUEUED", expiresAt: { gt: new Date() }, ...(filter.sessionId ? { sessionId: filter.sessionId } : {}) },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  const out: WireTask[] = [];
  for (const t of tasks) {
    const claimed = await prisma.agentTask.updateMany({ where: { id: t.id, status: "QUEUED" }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    if (claimed.count === 1) out.push(toWire(t));
  }
  return out;
}
