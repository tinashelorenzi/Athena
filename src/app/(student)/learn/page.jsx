import { StudentHome } from '@/components/screens/student/StudentHome';
import { requireUser } from '@/lib/auth';
import { getStudentScenarios } from '@/lib/student';
import { prisma } from '@/lib/db';

/* Student home — the scenarios released to their cohort. */
export default async function LearnPage() {
  const user = await requireUser();
  const [scenarios, dbUser] = await Promise.all([
    getStudentScenarios(user.id),
    prisma.user.findUnique({ where: { id: user.id }, select: { cohort: { select: { name: true } } } }),
  ]);

  return (
    <StudentHome
      user={{ name: user.name, cohort: dbUser?.cohort?.name ?? null }}
      scenarios={scenarios}
    />
  );
}
