'use client';
import React from 'react';
import * as FW from '@/components/ds';
import { Icon } from '@/components/Icon';
import { AthenaData } from '@/lib/data';

/* Firewall & UTM — policy rules table + security profiles. */
export function FirewallScreen() {
  const [rules, setRules] = React.useState(AthenaData.firewallRules);
  const utm = AthenaData.utm;
  const toggle = (id) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px' }}>Policy — Perimeter (edge-fw-01)</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: 0 }}>Rules evaluate top-down; first match wins.</p>
          </div>
          <FW.Button variant="primary" size="sm" leadingIcon={<Icon name="Plus" size={15} />}>Add rule</FW.Button>
        </div>

        <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--surface-card)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '44px 56px 90px 1.3fr 1.3fr 70px 70px 1fr 70px', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border-default)', background: 'var(--surface-panel)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            <span>On</span><span>#</span><span>Action</span><span>Source</span><span>Destination</span><span>Port</span><span>Proto</span><span>Note</span><span style={{ textAlign: 'right' }}>Hits</span>
          </div>
          {rules.map((r, i) => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '44px 56px 90px 1.3fr 1.3fr 70px 70px 1fr 70px', gap: 10, padding: '11px 14px', alignItems: 'center', borderBottom: i < rules.length - 1 ? '1px solid var(--border-subtle)' : 'none', opacity: r.enabled ? 1 : 0.5 }}>
              <FW.Switch checked={r.enabled} onChange={() => toggle(r.id)} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>{String(i + 1).padStart(2, '0')}</span>
              <FW.Badge tone={r.action === 'deny' ? 'danger' : 'success'} square>{r.action === 'deny' ? 'DENY' : 'ALLOW'}</FW.Badge>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{r.src}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{r.dst}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{r.port}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{r.proto}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.note}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: r.hits > 500 ? 'var(--accent)' : 'var(--text-secondary)', textAlign: 'right' }}>{r.hits.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <aside style={{ width: 320, flex: 'none', borderLeft: '1px solid var(--border-subtle)', background: 'var(--surface-panel)', overflow: 'auto', padding: '20px 18px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>UTM profiles</h3>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 16px' }}>Unified threat management on this edge.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {utm.map((u) => (
            <div key={u.name} style={{ padding: '13px 14px', background: 'var(--surface-card)', border: `1px solid ${u.on ? 'var(--border-default)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</span>
                <FW.Switch checked={u.on} onChange={() => {}} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 5 }}>{u.detail}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--brand-subtle-bg)', border: '1px solid var(--brand-subtle-border)', fontSize: 12, color: 'var(--blue-200)', display: 'flex', gap: 8 }}>
          <Icon name="Info" size={14} style={{ flex: 'none', marginTop: 1 }} /> Objective: block the C2 IP 185.220.101.34 to complete containment.
        </div>
      </aside>
    </div>
  );
}

export default FirewallScreen;
