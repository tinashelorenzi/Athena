'use client';
import React, { useMemo, useState } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { filterLogs, availableFields } from '@/lib/kql';

/* Kibana-Discover-style log search. Students query the fired log stream with KQL
   (field:value, and/or/not, wildcards, comparisons) and expand documents to the
   full field set — closer to real ELK than a static table. */
function ecsDoc(e) {
  const base = {
    '@timestamp': e.ts,
    'host.name': e.host,
    'event.dataset': e.source,
    'event.action': e.action,
    'user.name': e.user,
    message: e.message,
  };
  if (e.fields) for (const k of Object.keys(e.fields)) base[k] = e.fields[k];
  return base;
}

export function LogsPanel({ run }) {
  const entries = Array.isArray(run.logs) ? run.logs : [];
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [showFields, setShowFields] = useState(true);

  const { docs, error } = useMemo(() => filterLogs(query, entries), [query, entries]);
  const fields = useMemo(() => availableFields(entries), [entries]);
  const toggle = (i) => setExpanded((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const addField = (f) => setQuery((q) => (q.trim() ? `${q.trim()} and ${f}:` : `${f}:`));

  const Title = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <Icon name="ScrollText" size={18} style={{ color: 'var(--text-secondary)' }} />
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Logs · Discover</h2>
        <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Search the stream with KQL{run.status === 'PAUSED' ? ' · paused' : ''}</div>
      </div>
    </div>
  );

  if (run.status === 'NONE') {
    return <div>{Title}<AC.Card><div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 13 }}><Icon name="ScrollText" size={16} /> Press <strong style={{ color: 'var(--text-secondary)' }}>Run scenario</strong> to begin the log feed.</div></AC.Card></div>;
  }

  return (
    <div>
      {Title}

      {/* KQL query bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-inset)', border: '1px solid ' + (error ? 'var(--status-danger, #ef4444)' : 'var(--border-default)') }}>
          <Icon name="Search" size={15} style={{ color: 'var(--text-tertiary)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={'event.action:process_start and host.name:win-ep-04'}
            spellCheck={false}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13 }}
          />
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: 4 }}>KQL</span>
          {query && <AC.IconButton label="Clear" onClick={() => setQuery('')}><Icon name="X" size={14} /></AC.IconButton>}
        </div>
        <AC.IconButton label={showFields ? 'Hide fields' : 'Show fields'} onClick={() => setShowFields((v) => !v)}><Icon name="Columns3" size={16} /></AC.IconButton>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
        {error ? <span style={{ color: 'var(--status-danger, #ef4444)' }}>{error}</span> : <><strong style={{ color: 'var(--text-secondary)' }}>{docs.length}</strong> of {entries.length} events</>}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {showFields && (
          <div style={{ width: 180, flex: 'none' }}>
            <AC.Card padded={false}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Fields</div>
              <div style={{ maxHeight: 460, overflow: 'auto', padding: 6 }}>
                {fields.map((f) => (
                  <button key={f} onClick={() => addField(f)} title={`Filter on ${f}`} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    <Icon name="Hash" size={11} style={{ color: 'var(--text-tertiary)', flex: 'none' }} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                  </button>
                ))}
              </div>
            </AC.Card>
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <AC.Card padded={false}>
            {entries.length === 0 ? (
              <div style={{ padding: 16, fontSize: 13, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 8 }}><AC.Spinner size={14} /> Monitoring… log events will stream in as they fire.</div>
            ) : docs.length === 0 ? (
              <div style={{ padding: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>No events match your query.</div>
            ) : (
              <div>
                {docs.map((e, i) => {
                  const open = expanded.has(i);
                  const doc = ecsDoc(e);
                  return (
                    <div key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <button onClick={() => toggle(i)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={13} style={{ color: 'var(--text-tertiary)', flex: 'none' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)', flex: 'none', width: 165 }}>{e.ts}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--accent, #7c8cff)' }}>{e.host}</span> {e.action} · {e.message}
                        </span>
                      </button>
                      {open && (
                        <div style={{ padding: '4px 12px 12px 35px', display: 'grid', gridTemplateColumns: '180px 1fr', gap: '3px 12px' }}>
                          {Object.entries(doc).map(([k, v]) => (
                            <React.Fragment key={k}>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>{k}</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{v === null || v === undefined ? '—' : String(v)}</div>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </AC.Card>
        </div>
      </div>
    </div>
  );
}

export default LogsPanel;
