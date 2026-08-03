import { AssignmentsManager } from '@/components/screens/AssignmentsManager';
import { AthenaData } from '@/lib/data';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

/* Assignment Scenarios — assign the SOC training scenarios (static catalog in
   src/lib/data.js) to students. Assignments are persisted (Assignment model). */
export default async function AssignmentsPage() {
  await requireRole('SUPER_ADMIN');

  const [students, assignments] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'STUDENT' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    }),
    prisma.assignment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { student: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const scenarios = AthenaData.scenarios.map((s) => ({
    id: s.id,
    title: s.title,
    tag: s.tag,
    difficulty: s.difficulty,
    mins: s.mins,
    desc: s.desc,
    tactics: s.tactics,
    color: s.color,
  }));

  const assigned = assignments.map((a) => ({
    id: a.id,
    scenarioId: a.scenarioId,
    status: a.status,
    dueAt: a.dueAt ? a.dueAt.toISOString() : null,
    student: a.student,
  }));

  return <AssignmentsManager scenarios={scenarios} students={students} assignments={assigned} />;
}
