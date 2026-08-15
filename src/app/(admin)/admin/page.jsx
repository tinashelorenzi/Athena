import Link from 'next/link';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { getGradingStats, getGradingQueue } from '@/lib/grading';

/* Instructor dashboard — live overview of the lab: people, content, and the
   grading work waiting on you. */
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

  const rows = recentStudents.map((s) => ({ ...s, added: s.createdAt.toISOString().slice(0, 10) }));
  // Work waiting on the instructor: ungraded first, then held (not released).
  const attention = queue
    .filter((q) => q.status !== 'GRADED' || !q.released)
    .sort((a, b) => (a.status === 'GRADED' ? 1 : 0) - (b.status === 'GRADED' ? 1 : 0))
    .slice(0, 6);

  return (
    <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Welcome, {user.name.split(' ')[0]}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>Your SOC lab at a glance.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <AC.StatCard label="Students" value={String(studentCount)} icon={<Icon name="Users" size={16} />} hint="Enrolled in the lab" />
        <AC.StatCard label="Cohorts" value={String(cohortCount)} icon={<Icon name="GraduationCap" size={16} />} hint="Active classes" />
        <AC.StatCard label="Scenarios" value={String(scenarioCount)} icon={<Icon name="Boxes" size={16} />} hint="Authored" />
        <AC.StatCard label="Needs grading" value={String(stats.needsGrading)} tone={stats.needsGrading ? 'warning' : 'default'} icon={<Icon name="Inbox" size={16} />} hint="Awaiting a grade" />
        <AC.StatCard label="Held" value={String(stats.held)} tone={stats.held ? 'accent' : 'default'} icon={<Icon name="EyeOff" size={16} />} hint="Graded, not released" />
      </div>

      <AC.Card
        padded={false}
        header={<div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="ListChecks" size={16} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>Needs your attention</span>
          </div>
          <Link href="/admin/grading" style={{ textDecoration: 'none' }}><AC.Button variant="secondary" size="sm" leadingIcon={<Icon name="PenLine" size={14} />}>Open grading queue</AC.Button></Link>
        </div>}
      >
        {attention.length === 0 ? (
          <div style={{ padding: 8 }}><AC.EmptyState icon={<Icon name="CircleCheck" size={22} />} title="All caught up" description="No submissions are waiting to be graded or released." /></div>
        ) : (
          <AC.Table
            rowKey="id"
            hover={false}
            columns={[
              { key: 'studentName', header: 'Student', primary: true },
              { key: 'cohortName', header: 'Cohort', width: '150px' },
              { key: 'scenarioTitle', header: 'Scenario' },
              { key: 'submitted', header: 'Submitted', width: '110px', mono: true },
              { key: 'state', header: 'State', width: '150px' },
            ]}
            rows={attention.map((q) => ({
              id: q.id, studentName: q.studentName, cohortName: q.cohortName, scenarioTitle: q.scenarioTitle,
              submitted: q.submitted.slice(0, 10),
              state: q.status !== 'GRADED'
                ? <AC.Badge tone="warning" dot square>Needs grading</AC.Badge>
                : <AC.Badge tone="accent" dot square>Held · {q.grade ?? '—'}</AC.Badge>,
            }))}
          />
        )}
      </AC.Card>

      <AC.Card
        title="Recently added students"
        actions={<Link href="/admin/students" style={{ textDecoration: 'none' }}><AC.Button variant="secondary" size="sm" leadingIcon={<Icon name="Users" size={14} />}>Manage students</AC.Button></Link>}
      >
        {rows.length === 0 ? (
          <AC.EmptyState icon={<Icon name="UserPlus" size={24} />} title="No students yet" description="Add your first student from Student Management or a cohort." actions={<Link href="/admin/students" style={{ textDecoration: 'none' }}><AC.Button variant="primary" size="sm">Add students</AC.Button></Link>} />
        ) : (
          <AC.Table rowKey="id" hover={false} columns={[{ key: 'name', header: 'Name', primary: true }, { key: 'email', header: 'Email', mono: true }, { key: 'added', header: 'Added', align: 'right', mono: true }]} rows={rows} />
        )}
      </AC.Card>
    </div>
  );
}
