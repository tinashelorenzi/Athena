import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminShell } from '@/components/AdminShell';
import { StudentTopBar } from '@/components/screens/student/StudentTopBar';
import { AttackExplorer } from '@/components/attack/AttackExplorer';

export const metadata = { title: 'ATT&CK Explorer — Athena' };

/* MITRE ATT&CK Explorer (Enterprise + ICS). Open to every signed-in user:
   students get the student top bar, instructors their console shell. */
export default async function AttackPage({ searchParams }) {
  const user = await requireUser();
  const { domain, t } = await searchParams;
  const explorer = <AttackExplorer initialDomain={domain === 'ics' ? 'ics' : 'enterprise'} initialTechnique={t || null} />;

  if (user.role === 'SUPER_ADMIN') return <AdminShell user={user}>{explorer}</AdminShell>;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { cohort: { select: { name: true } } } });
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StudentTopBar user={{ id: user.id, name: user.name, cohort: dbUser?.cohort?.name ?? null }} />
      <main style={{ flex: 1 }}>{explorer}</main>
    </div>
  );
}
