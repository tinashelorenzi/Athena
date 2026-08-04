import { StudentsManager } from '@/components/screens/StudentsManager';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

/* Student Management — list + create/reset/delete. Data is fetched here (server)
   and the mutations run through Server Actions in @/app/actions/students. */
export default async function StudentsPage() {
  await requireRole('SUPER_ADMIN');

  const [students, cohorts] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'STUDENT' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, createdAt: true, cohort: { select: { name: true } } },
    }),
    prisma.cohort.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  const rows = students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    cohort: s.cohort?.name ?? '—',
    createdAt: s.createdAt.toISOString(),
  }));

  return <StudentsManager students={rows} cohorts={cohorts} />;
}
