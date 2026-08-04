import { CohortsList } from '@/components/screens/CohortsList';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

/* Cohorts index — groups of students, bindable to scenarios. */
export default async function CohortsPage() {
  await requireRole('SUPER_ADMIN');

  const cohorts = await prisma.cohort.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, createdAt: true, _count: { select: { students: true, scenarios: true } } },
  });

  const rows = cohorts.map((c) => ({
    id: c.id,
    name: c.name,
    students: c._count.students,
    scenarios: c._count.scenarios,
    created: c.createdAt.toISOString().slice(0, 10),
  }));

  return <CohortsList cohorts={rows} />;
}
