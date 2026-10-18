import { InstructorDashboard } from '@/components/screens/grading/InstructorDashboard';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { getGradingStats, getGradingQueue } from '@/lib/grading';

/* Instructor dashboard — live overview of the lab: people, content, and the
   grading work waiting on you. Data is fetched here; the antd view is a client
   component. */
export default async function AdminDashboardPage() {
  const user = await requireRole('SUPER_ADMIN');

  const [studentCount, cohortCount, scenarioCount, recentStudents, stats, queue] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.cohort.count(),
    prisma.scenario.count(),
    prisma.user.findMany({ where: { role: 'STUDENT' }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, name: true, email: true, createdAt: true } }),
    getGradingStats(),
    getGradingQueue(),
  ]);

  const rows = recentStudents.map((s) => ({ id: s.id, name: s.name, email: s.email, added: s.createdAt.toISOString().slice(0, 10) }));
  // Work waiting on the instructor: ungraded first, then held (not released).
  const attention = queue
    .filter((q) => q.status !== 'GRADED' || !q.released)
    .sort((a, b) => (a.status === 'GRADED' ? 1 : 0) - (b.status === 'GRADED' ? 1 : 0))
    .slice(0, 6)
    .map((q) => ({
      id: q.id, studentName: q.studentName, cohortName: q.cohortName, scenarioTitle: q.scenarioTitle,
      submitted: q.submitted, status: q.status, committed: q.committed, released: q.released, grade: q.grade,
    }));

  return (
    <InstructorDashboard
      firstName={user.name.split(' ')[0]}
      counts={{ students: studentCount, cohorts: cohortCount, scenarios: scenarioCount }}
      stats={stats}
      attention={attention}
      recentStudents={rows}
    />
  );
}
