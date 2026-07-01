'use client';
import React from 'react';
import * as FO from '@/components/ds';
import { Icon } from '@/components/Icon';

/* Forensics — scenario sample artifacts + static analysis. */
const SAMPLES = [
  { id: 1, name: 'Invoice_July.docm', type: 'Office macro', size: '84 KB', sha: 'a3f5c9d1…e8b027', verdict: 'malicious', icon: 'FileText' },
  { id: 2, name: 'svc.exe', type: 'PE32 executable', size: '412 KB', sha: '7bd44e2a…91ff03', verdict: 'malicious', icon: 'FileCog' },
  { id: 3, name: 'capture_1432.pcap', type: 'Network capture', size: '2.1 MB', sha: 'c01aa8f4…5d7e12', verdict: 'suspicious', icon: 'FileDigit' },
  { id: 4, name: 'memory.dmp', type: 'Memory image', size: '1.9 GB', sha: 'ff2093bc…0a4471', verdict: 'pending', icon: 'HardDrive' },
];
const VT = { malicious: { tone: 'danger', color: 'var(--sev-critical)', label: 'Malicious' }, suspicious: { tone: 'warning', color: 'var(--sev-high)', label: 'Suspicious' }, pending: { tone: 'neutral', color: 'var(--text-tertiary)', label: 'Not analyzed' } };
const STRINGS = ['powershell -nop -w hidden -enc', 'pay-invoice-verify.top', '185.220.101.34', 'vssadmin delete shadows', 'CreateRemoteThread', '.locked', 'YOUR FILES HAVE BEEN ENCRYPTED'];

export function ForensicsScreen() {
  const [sel, setSel] = React.useState(SAMPLES[0]);
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ width: 340, flex: 'none', borderRight: '1px solid var(--border-subtle)', background: 'var(--surface-panel)', overflow: 'auto', padding: '16px 14px' }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '2px 4px 10px' }}>Samples · Ransomware in Finance</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SAMPLES.map((s) => {
            const active = sel.id === s.id; const v = VT[s.verdict];
            return (
              <button key={s.id} onClick={() => setSel(s)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', textAlign: 'left', cursor: 'pointer', background: active ? 'var(--surface-selected)' : 'var(--surface-card)', border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm)' }}>
                <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-inset)', color: v.color }}><Icon name={s.icon} size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.type} · {s.size}</div>
                </div>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: v.color, flex: 'none' }} />
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 26px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
          <span style={{ width: 46, height: 46, flex: 'none', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-raised)', border: '1px solid var(--border-default)', color: VT[sel.verdict].color }}><Icon name={sel.icon} size={22} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{sel.name}</h2>
              <FO.Badge tone={VT[sel.verdict].tone} dot square>{VT[sel.verdict].label}</FO.Badge>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{sel.type} · {sel.size}</div>
          </div>
          <FO.Button variant="secondary" size="sm" leadingIcon={<Icon name="Download" size={14} />}>Download</FO.Button>
          <FO.Button variant="primary" size="sm" leadingIcon={<Icon name="ScanSearch" size={14} />}>Re-analyze</FO.Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 10 }}>Hashes</div>
            {[['SHA-256', sel.sha], ['MD5', '9e107d9d…f98402'], ['SSDEEP', '3072:xF9k…']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', fontSize: 12 }}>
                <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{k}</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 10 }}>Detection</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 600, color: VT[sel.verdict].color }}>41</span>
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>/ 68 engines flagged</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {['Ransom.LockBit', 'Trojan.Downloader', 'W97M/Dropper'].map((t) => <span key={t} style={{ fontSize: 11, color: 'var(--sev-critical)', background: 'var(--sev-critical-bg)', border: '1px solid var(--sev-critical-border)', borderRadius: 999, padding: '2px 9px', fontFamily: 'var(--font-mono)' }}>{t}</span>)}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Interesting strings</div>
        <div style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.9 }}>
          {STRINGS.map((s, i) => (
            <div key={i} style={{ color: /top|101\.34|encrypt|ENCRYPTED|enc|shadows/i.test(s) ? 'var(--sev-high)' : 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-tertiary)', marginRight: 12 }}>{String(0x400 + i * 16).toString(16).padStart(6, '0')}</span>{s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ForensicsScreen;
