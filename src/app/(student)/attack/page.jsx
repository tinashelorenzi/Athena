import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminShell } from '@/components/AdminShell';
import { StudentTopBar } from '@/components/screens/student/StudentTopBar';
import { AttackExplorer } from '@/components/attack/AttackExplorer';
import { getStudentScenarios } from '@/lib/student';

export const metadata = { title: 'ATT&CK Explorer — Athena' };

/* MITRE ATT&CK Explorer (Enterprise + ICS). Open to every signed-in user:
   students get the student top bar, instructors their console shell.
   `practice` lists the ATT&CK-tagged scenarios the viewer can open: those
   released to a student, or every scenario for an instructor. */
export default async function AttackPage({ searchParams }) {
  const user = await requireUser();
  const { domain, t } = await searchParams;
  const practice = await practiceScenarios(user);
  const explorer = (
    <AttackExplorer initialDomain={domain === 'ics' ? 'ics' : 'enterprise'} initialTechnique={t || null} practice={practice} />
  );

  if (user.role === 'SUPER_ADMIN') return <AdminShell user={user}>{explorer}</AdminShell>;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { cohort: { select: { name: true } } } });
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StudentTopBar user={{ id: user.id, name: user.name, cohort: dbUser?.cohort?.name ?? null }} />
      <main style={{ flex: 1 }}>{explorer}</main>
    </div>
  );
}

async function practiceScenarios(user) {
  if (user.role === 'SUPER_ADMIN') {
    const rows = await prisma.scenario.findMany({
      where: { NOT: { techniques: { isEmpty: true } } },
      select: { id: true, title: true, type: true, techniques: true, kind: true },
      orderBy: { title: 'asc' },
    });
    // Only architects can open the preview; other instructors just see the list.
    return rows.map(({ kind, ...s }) => ({
      ...s,
      href: user.isArchitect ? (kind === 'LAB' ? `/admin/scenarios/${s.id}` : `/admin/scenarios/${s.id}/preview`) : null,
      status: null,
    }));
  }
  const cards = await getStudentScenarios(user.id);
  return cards
    .filter((s) => s.techniques.length)
    .map((s) => ({ id: s.id, title: s.title, type: s.type, techniques: s.techniques, href: `/learn/${s.id}`, status: s.status }));
}
