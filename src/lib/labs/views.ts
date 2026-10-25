import { prisma } from "@/lib/db";
import type { CheckResult, GradeResult } from "./language/grade";
import type { CompiledLab } from "./language/types";

/**
 * What a student (in the browser or through the CLI) may see of a lab session.
 * Results follow the lab's `showResults` policy; Assessment results also show
 * once the instructor releases the grade. Instructor-only checks and
 * evaluation details never leave the server.
 */

export type StudentCheck = Pick<CheckResult, "id" | "title" | "passed" | "skipped" | "points" | "max" | "hint" | "reason"> & {
  assertions: { label: string; passed: boolean; points: number; max: number }[];
};

export type RunView = {
  id: string;
  final: boolean;
  status: "COLLECTING" | "GRADED" | "FAILED";
  requestedAt: string;
  completedAt: string | null;
  /** False when results are hidden from the student. */
  visible: boolean;
  /** Final run whose score the instructor adjusted (score is the adjusted one). */
  adjusted: boolean;
  score: number | null;
  maxScore: number | null;
  checks: StudentCheck[];
};

export type SessionView = {
  id: string;
  status: string;
  note: string | null;
  labVersion: number;
  createdAt: string;
  startedAt: string | null;
  deadlineAt: string | null;
  endedAt: string | null;
  score: number | null;
  maxScore: number | null;
  scoreVisible: boolean;
  /** The instructor adjusted the final score (score is the adjusted one). */
  adjusted: boolean;
  machines: { role: string; machineId: string; label: string; hostname: string; baselineReady: boolean }[];
  runs: RunView[];
  /** Agent-side problems on the latest round of tasks, e.g. a machine that's off. */
  problems: string[];
  waitingOn: string[];
  practice: { allowed: boolean; used: number; max: number; cooldownSeconds: number };
};

export function resultsVisible(lab: CompiledLab, type: string, released: boolean): boolean {
  const mode = lab.session.checks.showResults;
  if (mode === "never") return released;
  if (mode === "always") return true;
  return type === "DOJO" || released;
}

function studentChecks(result: GradeResult | null): StudentCheck[] {
  if (!result) return [];
  return result.checks
    .filter((c) => c.visibility === "student" && !c.flag)
    .map((c) => ({
      id: c.id, title: c.title, passed: c.passed, skipped: c.skipped, points: c.points, max: c.max, hint: c.hint, reason: c.reason,
      // Only partial-credit parts have author-written labels. All-or-nothing
      // assertions are labelled with their raw expressions, which would give
      // the expected values away, so they are never sent.
      assertions: c.assertions.some((a) => a.max > 0) ? c.assertions.map((a) => ({ label: a.label, passed: a.passed, points: a.points, max: a.max })) : [],
    }));
}

export async function buildSessionView(sessionId: string): Promise<SessionView | null> {
  const s = await prisma.labSession.findUnique({
    where: { id: sessionId },
    include: {
      labVersion: { include: { lab: { include: { scenario: { select: { type: true } } } } } },
      machines: { include: { machine: { select: { label: true, hostname: true } } } },
      checkRuns: { orderBy: { requestedAt: "desc" } },
      tasks: { orderBy: { createdAt: "desc" } },
      submission: { select: { releasedAt: true } },
    },
  });
  if (!s) return null;
  const lab = s.labVersion.definition as unknown as CompiledLab;
  const type = s.labVersion.lab.scenario.type;
  const released = Boolean(s.submission?.releasedAt);
  const visible = resultsVisible(lab, type, released);

  // Problems/waiting refer to the newest batch of tasks (the latest check run, or the baseline).
  const latestRun = s.checkRuns[0];
  const batch = latestRun ? s.tasks.filter((t) => t.checkRunId === latestRun.id) : s.tasks.filter((t) => t.kind === "BASELINE");
  const label = (role: string | null) => s.machines.find((m) => m.role === role)?.machine.label ?? role ?? "?";
  const practiceUsed = s.checkRuns.filter((r) => !r.final).length;

  return {
    id: s.id,
    status: s.status,
    note: s.note,
    labVersion: s.labVersion.version,
    createdAt: s.createdAt.toISOString(),
    startedAt: s.startedAt?.toISOString() ?? null,
    deadlineAt: s.deadlineAt?.toISOString() ?? null,
    endedAt: s.endedAt?.toISOString() ?? null,
    score: visible ? s.overrideScore ?? s.score : null,
    maxScore: visible ? s.maxScore : null,
    scoreVisible: visible,
    adjusted: visible && s.overrideScore != null,
    machines: s.machines.map((m) => ({ role: m.role, machineId: m.machineId, label: m.machine.label, hostname: m.machine.hostname, baselineReady: m.baseline != null })),
    runs: s.checkRuns.map((r, i) => ({
      id: r.id,
      final: r.final,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      visible,
      // The latest final run carries the session's (possibly adjusted) final score.
      adjusted: visible && r.final && i === s.checkRuns.findIndex((x) => x.final) && s.overrideScore != null,
      score: visible ? (r.final && i === s.checkRuns.findIndex((x) => x.final) && s.overrideScore != null ? s.overrideScore : r.score) : null,
      maxScore: visible ? r.maxScore : null,
      checks: visible ? studentChecks(r.result as unknown as GradeResult | null) : [],
    })),
    problems: batch.filter((t) => t.status === "FAILED" || t.status === "EXPIRED").map((t) => `${label(t.role)}: ${t.error ?? t.status.toLowerCase()}`),
    waitingOn: batch.filter((t) => t.status === "QUEUED" || t.status === "DELIVERED").map((t) => label(t.role)),
    practice: { allowed: lab.session.checks.practice, used: practiceUsed, max: lab.session.checks.maxPractice, cooldownSeconds: lab.session.checks.cooldownSeconds },
  };
}
