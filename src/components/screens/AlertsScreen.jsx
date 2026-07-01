'use client';
import React from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { AthenaData } from '@/lib/data';

/* Alerts queue — triage, assign, escalate. Table + detail panel. */
const STATUS_META = {
  open: { tone: 'brand', label: 'Open' },
  in_progress: { tone: 'accent', label: 'In progress' },
  escalated: { tone: 'danger', label: 'Escalated' },
  resolved: { tone: 'success', label: 'Resolved' },
};

function AlertDetail({ a, onClose }) {
  return (
    <aside style={{
      width: 380, flex: 'none', borderLeft: '1px solid var(--border-subtle)', background: 'var(--surface-panel)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AC.SeverityBadge level={a.sev} solid />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>{a.id}</span>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.35 }}>{a.rule}</h3>
        </div>
        <AC.IconButton label="Close" onClick={onClose}><Icon name="X" size={18} /></AC.IconButton>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginBottom: 18 }}>
          {[['Detected', a.time], ['Host', a.host], ['Source IP', a.src], ['Destination', a.dst], ['Tactic', a.tactic], ['Technique', a.technique], ['Events', String(a.count)], ['Assignee', a.assignee || 'Unassigned']].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 3 }}>{k}</div>
              <div style={{ fontFamily: /IP|Host|Detected|Technique|Events/.test(k) ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: 13, color: 'var(--text-primary)' }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '4px 0 8px' }}>Triage timeline</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[['Rule matched', a.time, 'Zap'], ['Correlated with 2 alerts', '14:32', 'GitMerge'], ['Enriched with threat intel', '14:32', 'Radar']].map(([t, tm, ic], i, arr) => (
            <div key={i} style={{ display: 'flex', gap: 11 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ width: 24, height: 24, borderRadius: 999, background: 'var(--surface-raised)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-strong)' }}><Icon name={ic} size={12} /></span>
                {i < arr.length - 1 && <span style={{ width: 1, flex: 1, background: 'var(--border-default)', minHeight: 14 }} />}
              </div>
              <div style={{ paddingBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{tm}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <AC.Button variant="primary" size="sm" leadingIcon={<Icon name="UserCheck" size={14} />}>Assign to me</AC.Button>
        <AC.Button variant="accent" size="sm" leadingIcon={<Icon name="TrendingUp" size={14} />}>Escalate</AC.Button>
        <AC.Button variant="secondary" size="sm" leadingIcon={<Icon name="ScrollText" size={14} />}>View in Logs</AC.Button>
      </div>
    </aside>
  );
}

export function AlertsScreen() {
  const alerts = AthenaData.alerts;
  const [sel, setSel] = React.useState(alerts[0]);
  const [sev, setSev] = React.useState('all');
  const rows = sev === 'all' ? alerts : alerts.filter((a) => a.sev === sev);
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  alerts.forEach((a) => { if (counts[a.sev] != null) counts[a.sev]++; });

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '20px 24px', gap: 16, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <AC.StatCard label="Open alerts" value={String(alerts.filter((a) => a.status === 'open').length)} icon={<Icon name="Bell" size={16} />} delta="+3" deltaDir="up" hint="last hour" />
          <AC.StatCard label="Critical" value={String(counts.critical)} tone="critical" delta="+1" deltaDir="up" />
          <AC.StatCard label="Assigned to me" value="2" icon={<Icon name="UserCheck" size={16} />} />
          <AC.StatCard label="Median triage" value="4m 12s" icon={<Icon name="Timer" size={16} />} deltaDir="down" delta="-38s" hint="better" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <AC.Tabs variant="pill" value={sev} onChange={setSev} tabs={[{ id: 'all', label: 'All' }, { id: 'critical', label: 'Critical' }, { id: 'high', label: 'High' }, { id: 'medium', label: 'Medium' }, { id: 'low', label: 'Low' }]} />
          <div style={{ flex: 1 }} />
          <AC.Input size="sm" placeholder="Filter alerts…" leadingIcon={<Icon name="Search" size={15} />} />
          <AC.Button variant="secondary" size="sm" leadingIcon={<Icon name="RotateCw" size={14} />}>Refresh</AC.Button>
        </div>

        <AC.Table
          rowKey="id"
          selectedKey={sel && sel.id}
          onRowClick={setSel}
          columns={[
            { key: 'sev', header: 'Severity', width: '112px', render: (v) => <AC.SeverityBadge level={v} /> },
            { key: 'time', header: 'Detected', mono: true, width: '160px' },
            { key: 'rule', header: 'Rule', primary: true },
            { key: 'host', header: 'Host', mono: true, width: '110px' },
            { key: 'status', header: 'Status', width: '120px', render: (v) => <AC.Badge tone={STATUS_META[v].tone} dot square>{STATUS_META[v].label}</AC.Badge> },
            { key: 'count', header: 'Events', align: 'right', mono: true, width: '80px' },
          ]}
          rows={rows}
        />
      </div>
      {sel && <AlertDetail a={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

export default AlertsScreen;
