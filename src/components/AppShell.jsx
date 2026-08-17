'use client';
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarNav, IconButton, Avatar, Tooltip } from '@/components/ds';
import { Icon } from '@/components/Icon';
import { AthenaData } from '@/lib/data';
import { logout } from '@/app/actions/auth';

/* Athena app shell: sidebar nav + top bar + content region.
   Ported from the UI kit's view/setView SPA to real Next.js routing:
   the active surface is derived from the URL and nav clicks push routes. */
const NAV = [
  { section: 'Operations' },
  { id: 'scenarios', label: 'Scenarios', ic: 'Target' },
  { id: 'alerts', label: 'Alerts', ic: 'Bell' },
  { id: 'logs', label: 'Logs', ic: 'ScrollText' },
  { section: 'Investigate' },
  { id: 'edr', label: 'EDR', ic: 'MonitorSmartphone' },
  { id: 'osquery', label: 'OSQuery', ic: 'TerminalSquare' },
  { id: 'intel', label: 'Threat Intel', ic: 'Radar' },
  { section: 'Respond' },
  { id: 'firewall', label: 'Firewall', ic: 'BrickWall' },
  { id: 'forensics', label: 'Forensics', ic: 'FlaskConical' },
];

const TITLES = {
  scenarios: 'Scenarios', alerts: 'Alerts', logs: 'Logs', edr: 'Endpoint Detection & Response',
  osquery: 'OSQuery', intel: 'Threat Intelligence', firewall: 'Firewall & UTM', forensics: 'Forensics',
};

export function AppShell({ children, user }) {
  const router = useRouter();
  const pathname = usePathname();
  const view = (pathname || '/').split('/')[1] || 'alerts';

  const displayName = user?.name || 'Analyst';
  const roleLabel = user?.role === 'SUPER_ADMIN' ? 'Instructor · Admin' : 'Tier-1 · Student';
  const isAdmin = user?.role === 'SUPER_ADMIN';

  const openAlerts = AthenaData.alerts.filter((a) => a.status === 'open').length;
  const items = NAV.map((n) =>
    n.section ? n : {
      id: n.id, label: n.label, icon: <Icon name={n.ic} size={18} />,
      badge: n.id === 'alerts' ? openAlerts : undefined,
      critical: n.id === 'alerts',
    }
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--surface-app)' }}>
      <SidebarNav
        active={view}
        onSelect={(id) => router.push(`/${id}`)}
        items={items}
        brand={
          <>
            <img src="/logo_img_white_background.png" alt="" style={{ height: 26, borderRadius: 6 }} />
            <span className="ath-nav__wordmark">Athena<small>Zaio SOC Lab</small></span>
          </>
        }
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px' }}>
            <Avatar name={displayName} size="md" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{roleLabel}</div>
            </div>
            {isAdmin && (
              <Tooltip content="Instructor dashboard" placement="top">
                <IconButton label="Instructor dashboard" onClick={() => router.push('/admin')}><Icon name="LayoutDashboard" size={16} /></IconButton>
              </Tooltip>
            )}
            <form action={logout} style={{ display: 'inline-flex' }}>
              <IconButton type="submit" label="Sign out"><Icon name="LogOut" size={16} /></IconButton>
            </form>
          </div>
        }
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title={TITLES[view] || 'Athena'} />
        <main style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>{children}</main>
      </div>
    </div>
  );
}

function TopBar({ title }) {
  return (
    <header style={{
      height: 'var(--topbar-h)', flex: 'none', display: 'flex', alignItems: 'center', gap: 16,
      padding: '0 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-panel)',
    }}>
      <h1 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>{title}</h1>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginLeft: 6, padding: '5px 10px',
        background: 'var(--accent-subtle-bg)', border: '1px solid var(--accent-subtle-border)',
        borderRadius: 'var(--radius-sm)',
      }}>
        <Icon name="Target" size={13} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 12, color: 'var(--yellow-300)', fontWeight: 600 }}>Active scenario</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ransomware in Finance</span>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 10px', width: 260,
        background: 'var(--surface-inset)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
        color: 'var(--text-tertiary)',
      }}>
        <Icon name="Search" size={15} />
        <span style={{ fontSize: 13 }}>Search hosts, IOCs, alerts…</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: 4 }}>⌘K</span>
      </div>

      <Tooltip content="UTC — 14:32" placement="bottom">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
          <Icon name="Clock" size={14} style={{ color: 'var(--text-tertiary)' }} />14:32 UTC
        </div>
      </Tooltip>
      <IconButton label="Notifications"><Icon name="Bell" size={18} /></IconButton>
      <IconButton label="Help"><Icon name="CircleHelp" size={18} /></IconButton>
    </header>
  );
}

export default AppShell;
