'use client';
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarNav, IconButton, Avatar, Tooltip } from '@/components/ds';
import { Icon } from '@/components/Icon';
import { logout } from '@/app/actions/auth';

/* Instructor (SUPER_ADMIN) dashboard shell: sidebar + top bar + content.
   Mirrors AppShell but for the management surfaces. */
const NAV = [
  { section: 'Instructor' },
  { id: 'admin', label: 'Dashboard', ic: 'LayoutDashboard' },
  { id: 'students', label: 'Students', ic: 'Users' },
  { id: 'cohorts', label: 'Cohorts', ic: 'GraduationCap' },
  { id: 'assignments', label: 'Assignments', ic: 'ClipboardList' },
  { section: 'Authoring', architectOnly: true },
  { id: 'scenarios', label: 'Scenarios', ic: 'Boxes', architectOnly: true },
  { section: 'Configuration' },
  { id: 'settings', label: 'Settings', ic: 'Settings' },
];

const TITLES = {
  admin: 'Instructor Dashboard',
  students: 'Student Management',
  cohorts: 'Cohorts',
  assignments: 'Assignment Scenarios',
  scenarios: 'Scenario Authoring',
  settings: 'Settings',
};

export function AdminShell({ children, user }) {
  const router = useRouter();
  const pathname = usePathname();
  // /admin -> 'admin', /admin/students -> 'students'
  const seg = (pathname || '/admin').split('/').filter(Boolean);
  const view = seg[1] || 'admin';

  const isArchitect = Boolean(user?.isArchitect);
  const items = NAV
    .filter((n) => !n.architectOnly || isArchitect)
    .map((n) => (n.section ? n : { id: n.id, label: n.label, icon: <Icon name={n.ic} size={18} /> }));

  const displayName = user?.name || 'Instructor';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--surface-app)' }}>
      <SidebarNav
        active={view}
        onSelect={(id) => router.push(id === 'admin' ? '/admin' : `/admin/${id}`)}
        items={items}
        brand={
          <>
            <img src="/logo_img_white_background.png" alt="" style={{ height: 26, borderRadius: 6 }} />
            <span className="ath-nav__wordmark">Athena<small>Instructor Console</small></span>
          </>
        }
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px' }}>
            <Avatar name={displayName} size="md" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Instructor · Admin</div>
            </div>
            {isArchitect && (
              <Tooltip content="Preview scenarios" placement="top">
                <IconButton label="Preview scenarios" onClick={() => router.push('/admin/scenarios')}><Icon name="FlaskConical" size={16} /></IconButton>
              </Tooltip>
            )}
            <IconButton label="Sign out" onClick={() => logout()}><Icon name="LogOut" size={16} /></IconButton>
          </div>
        }
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          height: 'var(--topbar-h)', flex: 'none', display: 'flex', alignItems: 'center', gap: 16,
          padding: '0 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-panel)',
        }}>
          <h1 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>{TITLES[view] || 'Athena'}</h1>
          <div style={{ flex: 1 }} />
          <IconButton label="Help"><Icon name="CircleHelp" size={18} /></IconButton>
        </header>
        <main style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>{children}</main>
      </div>
    </div>
  );
}

export default AdminShell;
