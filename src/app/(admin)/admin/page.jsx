import Link from 'next/link';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

/* Instructor dashboard — a lightweight overview plus a jump into student mgmt. */
export default async function AdminDashboardPage() {
  const user = await requireRole('SUPER_ADMIN');

  const [studentCount, instructorCount, recentStudents] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'SUPER_ADMIN' } }),
    prisma.user.findMany({
      where: { role: 'STUDENT' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true },
    }),
  ]);

  // Pre-format for the table: a Server Component can't pass `render` functions
  // to the (client) Table, so we compute display strings here.
  const rows = recentStudents.map((s) => ({ ...s, added: s.createdAt.toISOString().slice(0, 10) }));

  return (
    <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Welcome, {user.name.split(' ')[0]}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>
          Manage the students who use the Athena SOC lab.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <AC.StatCard label="Students" value={String(studentCount)} icon={<Icon name="Users" size={16} />} hint="Enrolled in the lab" />
        <AC.StatCard label="Instructors" value={String(instructorCount)} icon={<Icon name="ShieldCheck" size={16} />} hint="Super admins" />
        <AC.StatCard label="Active scenario" value="SC-07" tone="accent" icon={<Icon name="Target" size={16} />} hint="Ransomware in Finance" />
      </div>

      <AC.Card
        title="Recently added students"
        actions={
          <Link href="/admin/students" style={{ textDecoration: 'none' }}>
            <AC.Button variant="secondary" size="sm" leadingIcon={<Icon name="Users" size={14} />}>Manage students</AC.Button>
          </Link>
        }
      >
        {rows.length === 0 ? (
          <AC.EmptyState
            icon={<Icon name="UserPlus" size={24} />}
            title="No students yet"
            description="Add your first student from the Student Management page."
            actions={
              <Link href="/admin/students" style={{ textDecoration: 'none' }}>
                <AC.Button variant="primary" size="sm">Add students</AC.Button>
              </Link>
            }
          />
        ) : (
          <AC.Table
            rowKey="id"
            hover={false}
            columns={[
              { key: 'name', header: 'Name', primary: true },
              { key: 'email', header: 'Email', mono: true },
              { key: 'added', header: 'Added', align: 'right', mono: true },
            ]}
            rows={rows}
          />
        )}
      </AC.Card>
    </div>
  );
}
