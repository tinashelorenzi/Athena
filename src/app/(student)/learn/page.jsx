import { StudentHome } from '@/components/screens/student/StudentHome';
import { requireUser } from '@/lib/auth';
import { getStudentScenarios, getStudentResults } from '@/lib/student';
import { getStudentStanding, getStudentRank, getCohortLeaderboard } from '@/lib/reputation';
import { prisma } from '@/lib/db';

/* Student home — the scenarios released to their cohort, their standing, and
   their released results + feedback. */
export default async function LearnPage() {
  const user = await requireUser();
  const [scenarios, dbUser, standing, rank, results] = await Promise.all([
    getStudentScenarios(user.id),
    prisma.user.findUnique({ where: { id: user.id }, select: { cohort: { select: { id: true, name: true } } } }),
    getStudentStanding(user.id),
    getStudentRank(user.id),
    getStudentResults(user.id),
  ]);

  const leaderboard = dbUser?.cohort?.id ? await getCohortLeaderboard(dbUser.cohort.id) : [];

  return (
    <StudentHome
      user={{ id: user.id, name: user.name, cohort: dbUser?.cohort?.name ?? null }}
      scenarios={scenarios}
      standing={standing}
      rank={rank}
      leaderboard={leaderboard}
      results={results}
    />
  );
}
