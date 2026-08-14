import { prisma } from "@/lib/db";

/**
 * Reputation & scoring (server-only). Reputation is earned from **graded
 * Assessment** scenarios — the instructor's grade (0–100) per assessment is the
 * points awarded. Dojos are formative learning and don't contribute. Everything
 * is computed from `Submission` rows, so it's always consistent with grading.
 */
const LEVELS = [
  { at: 0, title: "Recruit" },
  { at: 100, title: "Tier-1 Analyst" },
  { at: 300, title: "Tier-2 Analyst" },
  { at: 600, title: "Senior Analyst" },
  { at: 1000, title: "SOC Lead" },
  { at: 1500, title: "Threat Hunter" },
];

export function levelFor(points: number): { level: number; title: string; floor: number; nextAt: number | null } {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (points >= LEVELS[i].at) idx = i;
  const next = LEVELS[idx + 1] ?? null;
  return { level: idx + 1, title: LEVELS[idx].title, floor: LEVELS[idx].at, nextAt: next ? next.at : null };
}

export type Standing = {
  reputation: number;
  assessmentsGraded: number;
  level: number;
  title: string;
  floor: number;
  nextAt: number | null;
};

export async function getStudentStanding(userId: string): Promise<Standing> {
  const subs = await prisma.submission.findMany({
    // Only released grades count — a held grade isn't the student's result yet.
    where: { studentId: userId, status: "GRADED", releasedAt: { not: null }, scenario: { type: "ASSESSMENT" } },
    select: { grade: true },
  });
  const reputation = subs.reduce((sum, s) => sum + (s.grade ?? 0), 0);
  return { reputation, assessmentsGraded: subs.length, ...levelFor(reputation) };
}

export type LeaderboardRow = { id: string; name: string; reputation: number; assessments: number };

/** Cohort leaderboard, highest reputation first. */
export async function getCohortLeaderboard(cohortId: string): Promise<LeaderboardRow[]> {
  const students = await prisma.user.findMany({
    where: { cohortId, role: "STUDENT" },
    select: { id: true, name: true },
  });
  if (students.length === 0) return [];

  const subs = await prisma.submission.findMany({
    where: {
      studentId: { in: students.map((s) => s.id) },
      status: "GRADED",
      releasedAt: { not: null },
      scenario: { type: "ASSESSMENT" },
    },
    select: { studentId: true, grade: true },
  });

  const agg = new Map<string, { rep: number; n: number }>();
  for (const s of subs) {
    const e = agg.get(s.studentId) ?? { rep: 0, n: 0 };
    e.rep += s.grade ?? 0;
    e.n += 1;
    agg.set(s.studentId, e);
  }

  return students
    .map((s) => ({ id: s.id, name: s.name, reputation: agg.get(s.id)?.rep ?? 0, assessments: agg.get(s.id)?.n ?? 0 }))
    .sort((a, b) => b.reputation - a.reputation || a.name.localeCompare(b.name));
}

/** A student's 1-based rank within their cohort (and cohort size). */
export async function getStudentRank(userId: string): Promise<{ rank: number; total: number } | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { cohortId: true } });
  if (!user?.cohortId) return null;
  const board = await getCohortLeaderboard(user.cohortId);
  const idx = board.findIndex((r) => r.id === userId);
  return idx === -1 ? { rank: board.length, total: board.length } : { rank: idx + 1, total: board.length };
}
