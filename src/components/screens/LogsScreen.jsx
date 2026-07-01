'use client';
import React from 'react';
import * as LG from '@/components/ds';
import { Icon } from '@/components/Icon';
import { AthenaData } from '@/lib/data';

/* Logs — Kibana-Discover-style explorer: KQL bar, field sidebar, histogram, docs. */
const LEVEL_COLOR = { critical: 'var(--sev-critical)', warning: 'var(--sev-high)', notice: 'var(--accent)', info: 'var(--text-tertiary)' };

function FieldSidebar() {
  const [open, setOpen] = React.useState('event.action');
  return (
    <aside style={{ width: 240, flex: 'none', borderRight: '1px solid var(--border-subtle)', background: 'var(--surface-panel)', overflow: 'auto', padding: '12px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 8px', background: 'var(--surface-inset)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', marginBottom: 12 }}>
        <Icon name="Search" size={14} /><span style={{ fontSize: 12 }}>Search fields</span>
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '4px 8px' }}>Available fields</div>
      {AthenaData.fields.map((f) => {
        const isOpen = open === f.name;
        return (
          <div key={f.name}>
            <button onClick={() => setOpen(isOpen ? null : f.name)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: 'none', cursor: 'pointer',
              background: isOpen ? 'var(--surface-hover)' : 'transparent', borderRadius: 'var(--radius-xs)', color: 'var(--text-secondary)', textAlign: 'left',
            }}>
              <Icon name="Hash" size={13} style={{ color: 'var(--syntax-field)' }} />
              <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
              <Icon name={isOpen ? 'ChevronDown' : 'ChevronRight'} size={13} />
            </button>
            {isOpen && (
              <div style={{ padding: '4px 8px 10px 12px' }}>
                {f.top.map(([val, n]) => {
                  const pct = Math.round((n / f.count) * 100);
                  return (
                    <div key={val} style={{ marginBottom: 7 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{val}</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>{pct}%</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--surface-inset)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: pct + '%', height: '100%', background: 'var(--brand-strong)', borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

function Histogram() {
  const bars = AthenaData.histogram;
  const max = Math.max(...bars);
  return (
    <div style={{ padding: '12px 4px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 74 }}>
        {bars.map((b, i) => (
          <div key={i} title={b + ' events'} style={{ flex: 1, height: Math.max(3, (b / max) * 100) + '%', background: i > 13 ? 'var(--sev-critical)' : 'var(--brand-strong)', opacity: i > 13 ? 0.9 : 0.65, borderRadius: '2px 2px 0 0' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
        <span>14:15</span><span>14:20</span><span>14:25</span><span>14:30</span><span>now</span>
      </div>
    </div>
  );
}

function LogDoc({ d, expanded, onToggle }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div onClick={onToggle} style={{ display: 'flex', gap: 12, padding: '9px 14px', cursor: 'pointer', alignItems: 'baseline' }}>
        <Icon name={expanded ? 'ChevronDown' : 'ChevronRight'} size={13} style={{ color: 'var(--text-tertiary)', flex: 'none', marginTop: 2 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', flex: 'none', width: 176 }}>{d.t}</span>
        <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ color: LEVEL_COLOR[d.level], fontWeight: 600 }}>{d.level}</span>
          <span style={{ color: 'var(--text-tertiary)' }}> · </span>
          <span style={{ color: 'var(--syntax-field)' }}>host</span><span style={{ color: 'var(--syntax-operator)' }}>:</span><span style={{ color: 'var(--text-primary)' }}>{d.host}</span>
          <span style={{ color: 'var(--text-tertiary)' }}> · </span>
          <span style={{ color: 'var(--syntax-field)' }}>event.action</span><span style={{ color: 'var(--syntax-operator)' }}>:</span><span style={{ color: 'var(--syntax-value)' }}>{d.action}</span>
          <span style={{ color: 'var(--text-tertiary)' }}> · </span>{d.msg}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '4px 14px 14px 40px', background: 'var(--surface-inset)' }}>
          <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
{`{
  `}<span style={{ color: 'var(--syntax-field)' }}>"@timestamp"</span>{`: `}<span style={{ color: 'var(--syntax-string)' }}>"{d.t}"</span>{`,
  `}<span style={{ color: 'var(--syntax-field)' }}>"event.level"</span>{`: `}<span style={{ color: 'var(--syntax-string)' }}>"{d.level}"</span>{`,
  `}<span style={{ color: 'var(--syntax-field)' }}>"host.name"</span>{`: `}<span style={{ color: 'var(--syntax-string)' }}>"{d.host}"</span>{`,
  `}<span style={{ color: 'var(--syntax-field)' }}>"event.action"</span>{`: `}<span style={{ color: 'var(--syntax-string)' }}>"{d.action}"</span>{`,
  `}<span style={{ color: 'var(--syntax-field)' }}>"user.name"</span>{`: `}<span style={{ color: 'var(--syntax-string)' }}>"{d.user}"</span>{`,
  `}<span style={{ color: 'var(--syntax-field)' }}>"process.pid"</span>{`: `}<span style={{ color: 'var(--syntax-number)' }}>{d.pid}</span>{`,
  `}<span style={{ color: 'var(--syntax-field)' }}>"process.parent.pid"</span>{`: `}<span style={{ color: 'var(--syntax-number)' }}>{d.ppid}</span>{`,
  `}<span style={{ color: 'var(--syntax-field)' }}>"message"</span>{`: `}<span style={{ color: 'var(--syntax-string)' }}>"{d.msg}"</span>{`
}`}
          </pre>
        </div>
      )}
    </div>
  );
}

export function LogsScreen() {
  const [q, setQ] = React.useState('event.action : "process_start" and user.name : "svc-batch"');
  const [lang, setLang] = React.useState('KQL');
  const [exp, setExp] = React.useState(0);
  const logs = AthenaData.logs;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <LG.KqlBar value={q} onChange={setQ} onRun={() => {}} language={lang} onToggleLanguage={() => setLang((l) => (l === 'KQL' ? 'EQL' : 'KQL'))} timeRange="Last 15 minutes" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Filters</span>
          <LG.Tag filter field="host.name" op=":" value="win-ep-04" onRemove={() => {}} />
          <LG.Tag filter field="event.outcome" op=":" value="success" onRemove={() => {}} />
          <button style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: 12, cursor: 'pointer' }}>+ Add filter</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <FieldSidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>1,284</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>events · 10 shown</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <LG.IconButton variant="solid" label="Live tail"><Icon name="Radio" size={15} /></LG.IconButton>
              <LG.IconButton variant="solid" label="Columns"><Icon name="Columns3" size={15} /></LG.IconButton>
              <LG.IconButton variant="solid" label="Export"><Icon name="Download" size={15} /></LG.IconButton>
            </div>
          </div>
          <div style={{ padding: '0 12px', borderBottom: '1px solid var(--border-subtle)' }}><Histogram /></div>
          <div style={{ display: 'flex', gap: 12, padding: '7px 14px 7px 40px', borderBottom: '1px solid var(--border-default)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            <span style={{ width: 176 }}>Time</span><span>Document</span>
          </div>
          {logs.map((d, i) => <LogDoc key={i} d={d} expanded={exp === i} onToggle={() => setExp(exp === i ? -1 : i)} />)}
        </div>
      </div>
    </div>
  );
}

export default LogsScreen;
