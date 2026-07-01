'use client';
import React from 'react';
import * as ED from '@/components/ds';
import { Icon } from '@/components/Icon';
import { AthenaData } from '@/lib/data';

/* EDR — endpoint detail: processes, network, files, browser & shell history. */
const FLAG_TONE = { malicious: 'danger', suspicious: 'warning', c2: 'danger', dns: 'warning', smb: 'neutral' };

export function EdrScreen() {
  const [tab, setTab] = React.useState('processes');
  const d = AthenaData;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Host header */}
      <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 46, height: 46, borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-strong)' }}>
          <Icon name="MonitorSmartphone" size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-mono)' }}>win-ep-04</h2>
            <ED.StatusDot status="isolated" label="Isolated by you" />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 5, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
            <span>Windows 11 Pro · 22H2</span><span>10.0.0.5</span><span>j.mensah (Finance)</span><span style={{ color: 'var(--sev-critical)' }}>Risk score 92</span>
          </div>
        </div>
        <ED.Button variant="secondary" size="sm" leadingIcon={<Icon name="Camera" size={14} />}>Snapshot</ED.Button>
        <ED.Button variant="outline-danger" size="sm" leadingIcon={<Icon name="ShieldOff" size={14} />}>Contain</ED.Button>
      </div>

      <div style={{ padding: '0 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-panel)' }}>
        <ED.Tabs value={tab} onChange={setTab} tabs={[
          { id: 'processes', label: 'Processes', count: 214, icon: <Icon name="Cpu" size={15} /> },
          { id: 'network', label: 'Network', count: 38, icon: <Icon name="Network" size={15} /> },
          { id: 'browser', label: 'Browser history', icon: <Icon name="Globe" size={15} /> },
          { id: 'shell', label: 'Shell history', icon: <Icon name="SquareTerminal" size={15} /> },
        ]} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '18px 24px' }}>
        {tab === 'processes' && (
          <ED.Table rowKey="pid" compact
            columns={[
              { key: 'name', header: 'Process', primary: true, render: (v, r) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>{r.susp && <Icon name="TriangleAlert" size={13} style={{ color: 'var(--sev-critical)' }} />}<span style={{ fontFamily: 'var(--font-mono)' }}>{v}</span></span> },
              { key: 'pid', header: 'PID', mono: true, width: '70px' },
              { key: 'parent', header: 'Parent', mono: true, width: '130px' },
              { key: 'user', header: 'User', mono: true, width: '100px' },
              { key: 'cpu', header: 'CPU %', align: 'right', mono: true, width: '80px' },
              { key: 'mem', header: 'Mem MB', align: 'right', mono: true, width: '90px' },
              { key: 'cmd', header: '', render: (v, r) => r.susp ? <ED.Badge tone="danger" square>Suspicious</ED.Badge> : null, width: '110px' },
            ]}
            rows={d.processes} />
        )}
        {tab === 'network' && (
          <ED.Table rowKey="laddr" compact
            columns={[
              { key: 'proto', header: 'Proto', mono: true, width: '70px' },
              { key: 'laddr', header: 'Local address', mono: true },
              { key: 'raddr', header: 'Remote address', mono: true, primary: true },
              { key: 'state', header: 'State', mono: true, width: '130px' },
              { key: 'proc', header: 'Process', mono: true },
              { key: 'flag', header: '', width: '110px', render: (v) => v ? <ED.Badge tone={FLAG_TONE[v] || 'neutral'} square>{v.toUpperCase()}</ED.Badge> : null },
            ]}
            rows={d.connections} />
        )}
        {tab === 'browser' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.browserHistory.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)', width: 56 }}>{h.t}</span>
                <Icon name="Globe" size={15} style={{ color: 'var(--text-tertiary)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{h.title}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.url}</div>
                </div>
                {h.flag && <ED.Badge tone={FLAG_TONE[h.flag]} square>{h.flag}</ED.Badge>}
              </div>
            ))}
          </div>
        )}
        {tab === 'shell' && (
          <div style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {d.shellHistory.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < d.shellHistory.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)', width: 56 }}>{h.t}</span>
                <span style={{ color: 'var(--status-success)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>$</span>
                <code style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: h.flag === 'malicious' ? 'var(--sev-critical)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.cmd}</code>
                {h.flag && <ED.Badge tone={FLAG_TONE[h.flag]} square>{h.flag}</ED.Badge>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default EdrScreen;
