import { notFound } from 'next/navigation';
import { CohortDetail } from '@/components/screens/CohortDetail';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

export default async function CohortDetailPage({ params }) {
  await requireRole('SUPER_ADMIN');
  const { id } = await params;

  const cohort = await prisma.cohort.findUnique({
    where: { id },
    include: {
      students: { orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } },
      scenarios: { include: { scenario: { select: { id: true, title: true, type: true } } } },
      invitations: {
        where: { acceptedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, createdAt: true, expiresAt: true },
      },
    },
  });
  if (!cohort) notFound();

  const [allScenarios, submissions] = await Promise.all([
    prisma.scenario.findMany({ orderBy: { title: 'asc' }, select: { id: true, title: true, type: true } }),
    prisma.submission.findMany({
      where: { student: { cohortId: id } },
      orderBy: { submittedAt: 'desc' },
      include: { student: { select: { name: true } }, scenario: { select: { title: true, flags: true } } },
    }),
  ]);

  const norm = (s) => String(s ?? '').trim().toLowerCase();

  return (
    <CohortDetail
      cohort={{ id: cohort.id, name: cohort.name }}
      students={cohort.students}
      bound={cohort.scenarios.map((cs) => ({ bindingId: cs.id, scenarioId: cs.scenario.id, title: cs.scenario.title, type: cs.scenario.type }))}
      invitations={cohort.invitations.map((i) => ({
        id: i.id, email: i.email,
        created: i.createdAt.toISOString().slice(0, 10),
        expires: i.expiresAt.toISOString().slice(0, 10),
      }))}
      allScenarios={allScenarios}
      submissions={submissions.map((s) => {
        const answers = s.flagAnswers || {};
        const flags = Array.isArray(s.scenario.flags) ? s.scenario.flags : [];
        return {
          id: s.id, studentName: s.student.name, scenarioTitle: s.scenario.title,
          submitted: s.submittedAt.toISOString().slice(0, 10),
          status: s.status, grade: s.grade,
          report: s.report || '',
          flagReview: flags.map((f) => ({
            question: f.question,
            answer: answers[f.id] ?? '',
            correct: Boolean(answers[f.id]) && norm(answers[f.id]) === norm(f.answer),
            points: f.points || 0,
          })),
        };
      })}
    />
  );
}
