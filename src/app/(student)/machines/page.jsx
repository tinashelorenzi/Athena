import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminShell } from '@/components/AdminShell';
import { StudentTopBar } from '@/components/screens/student/StudentTopBar';
import { MachinesScreen } from '@/components/screens/labs/MachinesScreen';
import { machineOnline } from '@/lib/labs/machines';

export const metadata = { title: 'Machines — Athena' };

/* The signed-in user's enrolled lab machines. Students use these for Labs;
   instructors enrol reference VMs here to author and test labs. */
export default async function MachinesPage() {
  const user = await requireUser();
  const rows = await prisma.machine.findMany({
    where: { userId: user.id, status: 'ACTIVE' },
    orderBy: { enrolledAt: 'asc' },
  });
  const machines = rows.map((m) => ({
    id: m.id,
    label: m.label,
    hostname: m.hostname,
    os: m.osPretty || `${m.os} ${m.osVersion}`,
    arch: m.arch,
    agentVersion: m.agentVersion,
    keyFingerprint: m.keyFingerprint,
    enrolledAt: m.enrolledAt.toISOString(),
    lastSeenAt: m.lastSeenAt?.toISOString() ?? null,
    online: machineOnline(m),
  }));
  const screen = <MachinesScreen machines={machines} email={user.email} />;

  if (user.role === 'SUPER_ADMIN') return <AdminShell user={user}>{screen}</AdminShell>;
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { cohort: { select: { name: true } } } });
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StudentTopBar user={{ id: user.id, name: user.name, cohort: dbUser?.cohort?.name ?? null }} />
      <main style={{ flex: 1 }}>{screen}</main>
    </div>
  );
}
