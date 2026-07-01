'use client';
import React from 'react';
import * as TI from '@/components/ds';
import { Icon } from '@/components/Icon';
import { AthenaData } from '@/lib/data';

/* Threat Intelligence — IOC search + enrichment. */
const VERDICT = {
  malicious: { tone: 'danger', color: 'var(--sev-critical)', label: 'Malicious' },
  suspicious: { tone: 'warning', color: 'var(--sev-high)', label: 'Suspicious' },
  informational: { tone: 'neutral', color: 'var(--text-tertiary)', label: 'Informational' },
};
const TYPE_ICON = { IPv4: 'Globe', Domain: 'Link', 'SHA-256': 'FileDigit', CVE: 'ShieldAlert' };

export function IntelScreen() {
  const iocs = AthenaData.iocs;
  const [sel, setSel] = React.useState(iocs[0]);
  const [q, setQ] = React.useState('185.220.101.34');

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto', padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <TI.Input value={q} onChange={(e) => setQ(e.target.value)} mono size="lg" leadingIcon={<Icon name="Radar" size={17} />} placeholder="Search an IP, domain, hash, or CVE…" />
          </div>
          <TI.Button variant="primary" size="lg" leadingIcon={<Icon name="Search" size={16} />}>Look up</TI.Button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '0 0 16px' }}>Enrichment aggregated across {sel ? sel.sources : 0} feeds · results cached 5m</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {iocs.map((io) => {
            const v = VERDICT[io.verdict];
            const active = sel && sel.value === io.value;
            return (
              <button key={io.value} onClick={() => setSel(io)} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', textAlign: 'left', cursor: 'pointer',
                background: active ? 'var(--surface-selected)' : 'var(--surface-card)',
                border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-md)',
              }}>
                <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-inset)', color: v.color }}>
                  <Icon name={TYPE_ICON[io.type]} size={17} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{io.value}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>{io.tags.map((t) => <span key={t} style={{ fontSize: 10.5, color: 'var(--text-secondary)', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 999, padding: '1px 8px' }}>{t}</span>)}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{io.type}</span>
                <TI.Badge tone={v.tone} dot square>{v.label}</TI.Badge>
              </button>
            );
          })}
        </div>
      </div>

      {sel && (
        <aside style={{ width: 360, flex: 'none', borderLeft: '1px solid var(--border-subtle)', background: 'var(--surface-panel)', overflow: 'auto', padding: '20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Icon name={TYPE_ICON[sel.type]} size={16} style={{ color: VERDICT[sel.verdict].color }} />
            <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>{sel.type}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-primary)', wordBreak: 'break-all', marginBottom: 16 }}>{sel.value}</div>

          {/* Verdict gauge */}
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Threat score</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: VERDICT[sel.verdict].color }}>{sel.score}<span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>/100</span></span>
            </div>
            <div style={{ height: 8, background: 'var(--surface-inset)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              <div style={{ width: sel.score + '%', height: '100%', background: VERDICT[sel.verdict].color, borderRadius: 999 }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>Flagged by <strong style={{ color: 'var(--text-secondary)' }}>{sel.sources}</strong> of 60 sources</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 12px', marginBottom: 16 }}>
            {[['First seen', sel.first], ['Network', sel.asn], ['Verdict', VERDICT[sel.verdict].label], ['Sources', String(sel.sources)]].map(([k, val]) => (
              <div key={k}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Related to your scenario</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--accent-subtle-bg)', border: '1px solid var(--accent-subtle-border)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 12.5, color: 'var(--yellow-300)' }}>
            <Icon name="Link2" size={14} /> Seen in 3 alerts on win-ep-04
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <TI.Button variant="danger" size="sm" leadingIcon={<Icon name="BrickWall" size={14} />}>Block in firewall</TI.Button>
            <TI.Button variant="secondary" size="sm" leadingIcon={<Icon name="BookmarkPlus" size={14} />}>Add to case</TI.Button>
          </div>
        </aside>
      )}
    </div>
  );
}

export default IntelScreen;
