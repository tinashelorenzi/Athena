import { prisma } from "@/lib/db";
import type { GradeResult } from "./language/grade";
import type { CompiledLab } from "./language/types";
import { LabError, gradeStoredRun, loadSessionCtx } from "./sessions";

/**
 * Instructor-side lab data (docs/labs/spec.md 12–13): every session with its
 * flags, a session's full detail, score overrides, re-grading with a diff,
 * and CSV rows. Server-only; callers check the instructor's role.
 */

export type SessionRow = {
  id: string;
  studentId: string;
  student: string;
  email: string;
  studentNumber: string | null;
  cohort: string | null;
  version: number;
  status: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  score: number | null;
  overrideScore: number | null;
  effectiveScore: number | null;
  maxScore: number | null;
  flags: string[];
  runs: number;
  machines: string[];
};

const effective = (s: { score: number | null; overrideScore: number | null }) => s.overrideScore ?? s.score;

export async function listLabSessions(labId: string): Promise<SessionRow[]> {
  const sessions = await prisma.labSession.findMany({
    where: { labVersion: { labId } },
    orderBy: { createdAt: "desc" },
    take: 2000,
    include: {
      user: { select: { id: true, name: true, email: true, studentNumber: true, cohort: { select: { name: true } } } },
      labVersion: { select: { version: true } },
      machines: { select: { role: true, machine: { select: { label: true } } } },
      _count: { select: { checkRuns: true } },
    },
  });
  return sessions.map((s) => ({
    id: s.id,
    studentId: s.user.id,
    student: s.user.name,
    email: s.user.email,
    studentNumber: s.user.studentNumber,
    cohort: s.user.cohort?.name ?? null,
    version: s.labVersion.version,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    startedAt: s.startedAt?.toISOString() ?? null,
    endedAt: s.endedAt?.toISOString() ?? null,
    score: s.score,
    overrideScore: s.overrideScore,
    effectiveScore: effective(s),
    maxScore: s.maxScore,
    flags: s.flags,
    runs: s._count.checkRuns,
    machines: s.machines.map((m) => `${m.role}: ${m.machine.label}`),
  }));
}

/** Everything about one session, for the instructor's drawer (results include evaluation notes). */
export async function getSessionDetail(sessionId: string) {
  const s = await prisma.labSession.findUnique({
    where: { id: sessionId },
    include: {
      user: { select: { name: true, email: true, cohort: { select: { name: true } } } },
      labVersion: { select: { id: true, version: true, labId: true } },
      machines: { include: { machine: { select: { label: true, hostname: true, osPretty: true, agentVersion: true } } } },
      checkRuns: { orderBy: { requestedAt: "asc" } },
      tasks: { orderBy: { createdAt: "asc" }, select: { id: true, kind: true, role: true, status: true, createdAt: true, deliveredAt: true, completedAt: true, error: true, checkRunId: true } },
    },
  });
  if (!s) return null;
  const [params, audit, overrideBy] = await Promise.all([
    prisma.labParam.findUnique({ where: { labId_userId: { labId: s.labVersion.labId, userId: s.userId } } }),
    prisma.labAuditEvent.findMany({
      where: { detail: { path: ["sessionId"], equals: sessionId } },
      orderBy: { createdAt: "asc" },
      select: { type: true, detail: true, createdAt: true },
    }),
    s.overrideById ? prisma.user.findUnique({ where: { id: s.overrideById }, select: { name: true } }) : null,
  ]);
  return {
    id: s.id,
    status: s.status,
    note: s.note,
    student: { name: s.user.name, email: s.user.email, cohort: s.user.cohort?.name ?? null },
    version: s.labVersion.version,
    params: (params?.values ?? {}) as Record<string, string | number>,
    nonce: s.nonce,
    createdAt: s.createdAt.toISOString(),
    startedAt: s.startedAt?.toISOString() ?? null,
    deadlineAt: s.deadlineAt?.toISOString() ?? null,
    endedAt: s.endedAt?.toISOString() ?? null,
    score: s.score,
    maxScore: s.maxScore,
    flags: s.flags,
    override: s.overrideScore != null
      ? { score: s.overrideScore, reason: s.overrideReason ?? "", by: overrideBy?.name ?? "an instructor", at: s.overrideAt?.toISOString() ?? null }
      : null,
    machines: s.machines.map((m) => {
      const b = (m.baseline ?? null) as { files?: Record<string, string>; logs?: Record<string, unknown>; bootId?: string; lockdown?: unknown; truncated?: boolean } | null;
      return {
        role: m.role,
        label: m.machine.label,
        hostname: m.machine.hostname,
        os: m.machine.osPretty,
        agentVersion: m.machine.agentVersion,
        baseline: b ? { files: Object.keys(b.files ?? {}).length, logs: Object.keys(b.logs ?? {}), bootId: b.bootId ?? null, lockdown: b.lockdown ?? null, truncated: Boolean(b.truncated) } : null,
      };
    }),
    runs: s.checkRuns.map((r) => ({
      id: r.id,
      final: r.final,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      score: r.score,
      maxScore: r.maxScore,
      graderRev: r.graderRev,
      regradedAt: r.regradedAt?.toISOString() ?? null,
      result: r.result as unknown as Omit<GradeResult, "parsed"> | null,
      evidence: r.evidence as unknown,
    })),
    tasks: s.tasks.map((t) => ({ ...t, createdAt: t.createdAt.toISOString(), deliveredAt: t.deliveredAt?.toISOString() ?? null, completedAt: t.completedAt?.toISOString() ?? null })),
    audit: audit.map((a) => ({ type: a.type, detail: a.detail, at: a.createdAt.toISOString() })),
  };
}

export type SessionDetail = NonNullable<Awaited<ReturnType<typeof getSessionDetail>>>;

/** Set (or clear with null) an instructor override of a finished session's score. */
export async function setScoreOverride(sessionId: string, score: number | null, reason: string, byUserId: string): Promise<void> {
  const s = await prisma.labSession.findUnique({ where: { id: sessionId } });
  if (!s) throw new LabError("not_found", "No such session.", 404);
  if (s.status !== "ENDED" || s.maxScore == null) throw new LabError("not_ended", "Only finished sessions can be adjusted.");
  if (score !== null) {
    if (!Number.isInteger(score) || score < 0 || score > s.maxScore) throw new LabError("bad_score", `The score must be a whole number from 0 to ${s.maxScore}.`);
    if (!reason.trim()) throw new LabError("no_reason", "Give a reason — it's kept with the session.");
  }
  await prisma.labSession.update({
    where: { id: sessionId },
    data: score === null
      ? { overrideScore: null, overrideReason: null, overrideById: null, overrideAt: null }
      : { overrideScore: score, overrideReason: reason.trim().slice(0, 500), overrideById: byUserId, overrideAt: new Date() },
  });
  await prisma.labAuditEvent.create({
    data: { type: "OVERRIDE", userId: byUserId, detail: { sessionId, from: s.overrideScore ?? s.score, to: score ?? s.score, reason: reason.trim(), cleared: score === null } },
  });
}

// ── Re-grading ──────────────────────────────────────────────────────────────

export type RegradeTarget = "own" | "latest";

export type RegradeDiff = {
  sessionId: string;
  student: string;
  version: number;
  gradedWith: number;
  oldScore: number | null;
  newScore: number;
  oldMax: number | null;
  newMax: number;
  oldFlags: string[];
  newFlags: string[];
  overridden: boolean;
  checks: { id: string; title: string; oldPoints: number | null; newPoints: number; oldMax: number | null; newMax: number; newReason: string | null }[];
  changed: boolean;
};

async function regradeItems(labId: string, target: RegradeTarget, sessionIds?: string[]) {
  const latest = await prisma.labVersion.findFirst({ where: { labId, draft: false }, orderBy: { version: "desc" } });
  if (!latest) throw new LabError("not_found", "This lab has no accepted version to re-grade with (only drafts).", 404);
  const sessions = await prisma.labSession.findMany({
    where: { labVersion: { labId }, status: "ENDED", ...(sessionIds?.length ? { id: { in: sessionIds } } : {}) },
    include: {
      user: { select: { name: true } },
      labVersion: { select: { id: true, version: true } },
      checkRuns: { where: { final: true, status: "GRADED" }, orderBy: { requestedAt: "desc" }, take: 1 },
    },
    orderBy: { endedAt: "desc" },
  });
  const latestDef = latest.definition as unknown as CompiledLab;
  const items = [];
  for (const s of sessions) {
    const run = s.checkRuns[0];
    if (!run) continue;
    const ctx = await loadSessionCtx(s.id);
    const versionId = target === "latest" ? latest.id : s.labVersion.id;
    const result = gradeStoredRun(ctx, run, target === "latest" ? latestDef : ctx.lab);
    items.push({ session: s, run, result, versionId, versionNumber: target === "latest" ? latest.version : s.labVersion.version });
  }
  return items;
}

export async function previewRegrade(labId: string, target: RegradeTarget, sessionIds?: string[]): Promise<RegradeDiff[]> {
  const items = await regradeItems(labId, target, sessionIds);
  return items.map(({ session, run, result, versionNumber }) => {
    const old = (run.result ?? null) as unknown as Omit<GradeResult, "parsed"> | null;
    const oldChecks = new Map((old?.checks ?? []).map((c) => [c.id, c]));
    const checks = result.checks
      .filter((c) => !c.flag)
      .map((c) => {
        const o = oldChecks.get(c.id);
        return { id: c.id, title: c.title, oldPoints: o ? o.points : null, newPoints: c.points, oldMax: o ? o.max : null, newMax: c.max, newReason: c.reason };
      })
      .filter((c) => c.oldPoints !== c.newPoints || c.oldMax !== c.newMax);
    const oldFlags = [...session.flags].sort();
    const newFlags = [...result.flags].sort();
    return {
      sessionId: session.id,
      student: session.user.name,
      version: session.labVersion.version,
      gradedWith: versionNumber,
      oldScore: session.score,
      newScore: result.score,
      oldMax: session.maxScore,
      newMax: result.maxScore,
      oldFlags,
      newFlags,
      overridden: session.overrideScore != null,
      checks,
      changed: session.score !== result.score || session.maxScore !== result.maxScore || oldFlags.join() !== newFlags.join() || checks.length > 0,
    };
  });
}

/** Re-grade (recomputed here, never trusting a preview) and store; returns how many sessions changed. */
export async function applyRegrade(labId: string, target: RegradeTarget, sessionIds: string[] | undefined, byUserId: string): Promise<number> {
  const items = await regradeItems(labId, target, sessionIds);
  let changed = 0;
  for (const { session, run, result, versionId } of items) {
    const { parsed: _parsed, ...stored } = result;
    void _parsed;
    const differs = session.score !== result.score || session.maxScore !== result.maxScore || [...session.flags].sort().join() !== [...result.flags].sort().join();
    await prisma.$transaction([
      prisma.labCheckRun.update({
        where: { id: run.id },
        data: { result: stored as object, score: result.score, maxScore: result.maxScore, graderRev: result.graderRev, regradedAt: new Date(), gradedWithVersionId: versionId },
      }),
      prisma.labSession.update({ where: { id: session.id }, data: { score: result.score, maxScore: result.maxScore, flags: result.flags } }),
      prisma.labAuditEvent.create({
        data: {
          type: "REGRADE",
          userId: byUserId,
          detail: { sessionId: session.id, target, versionId, from: { score: session.score, maxScore: session.maxScore, flags: session.flags }, to: { score: result.score, maxScore: result.maxScore, flags: result.flags }, graderRev: result.graderRev },
        },
      }),
    ]);
    if (differs) changed++;
  }
  return changed;
}

// ── CSV ─────────────────────────────────────────────────────────────────────

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV of a lab's sessions: one row per session (`all`) or each student's
 * latest finished session (`latest`), with a column per check.
 */
export async function labCsv(labId: string, scope: "latest" | "all"): Promise<string> {
  const latest = await prisma.labVersion.findFirst({ where: { labId, draft: false }, orderBy: { version: "desc" } });
  const checks = ((latest?.definition as unknown as CompiledLab | undefined)?.checks ?? []).filter((c) => !c.flag);
  const sessions = await prisma.labSession.findMany({
    where: { labVersion: { labId }, ...(scope === "latest" ? { status: "ENDED" } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, studentNumber: true, cohort: { select: { name: true } } } },
      labVersion: { select: { version: true } },
      checkRuns: { where: { final: true, status: "GRADED" }, orderBy: { requestedAt: "desc" }, take: 1, select: { result: true, gradedWithVersionId: true } },
    },
  });
  const versionNumbers = new Map((await prisma.labVersion.findMany({ where: { labId }, select: { id: true, version: true } })).map((v) => [v.id, v.version]));
  const picked = scope === "latest" ? sessions.filter((s, i) => sessions.findIndex((x) => x.userId === s.userId) === i) : sessions;
  const header = ["student", "email", "student_number", "cohort", "session_id", "lab_version", "graded_with_version", "status", "started_at", "ended_at", "score", "max_score", "override", "override_reason", "effective_score", "percent", "flags", ...checks.map((c) => `check:${c.id}`)];
  const lines = [header.map(csvCell).join(",")];
  for (const s of picked) {
    const result = (s.checkRuns[0]?.result ?? null) as unknown as Omit<GradeResult, "parsed"> | null;
    const byId = new Map((result?.checks ?? []).map((c) => [c.id, c]));
    const eff = effective(s);
    lines.push([
      s.user.name, s.user.email, s.user.studentNumber ?? "", s.user.cohort?.name ?? "", s.id, s.labVersion.version,
      versionNumbers.get(s.checkRuns[0]?.gradedWithVersionId ?? "") ?? s.labVersion.version, s.status,
      s.startedAt?.toISOString() ?? "", s.endedAt?.toISOString() ?? "", s.score ?? "", s.maxScore ?? "", s.overrideScore ?? "", s.overrideReason ?? "",
      eff ?? "", eff != null && s.maxScore ? Math.round((eff / s.maxScore) * 100) : "", s.flags.join(" "),
      ...checks.map((c) => (byId.has(c.id) ? `${byId.get(c.id)!.points}/${byId.get(c.id)!.max}` : "")),
    ].map(csvCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
