'use client';
import React, { useMemo, useState } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { filterLogs, availableFields } from '@/lib/kql';

/* Kibana-Discover-style log search: KQL query bar, a time histogram you can brush
   to select a window (the time controller), a field list, and expandable
   documents — as close to real ELK/Discover as a simulation gets. */
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
const hhmmss = (ms) => (Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(11, 19));
const tsMs = (e) => Date.parse(String(e.ts));

export function LogsPanel({ run }) {
  const entries = Array.isArray(run.logs) ? run.logs : [];
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [showFields, setShowFields] = useState(true);
  const [sel, setSel] = useState(null);          // { start, end } ms — brushed time window
  const [drag, setDrag] = useState(null);        // { a, b } bucket indices while dragging

  const { docs: kqlDocs, error } = useMemo(() => filterLogs(query, entries), [query, entries]);
  const fields = useMemo(() => availableFields(entries), [entries]);

  // Time span + buckets over all fired entries (stable axis).
  const { fullMin, fullMax, buckets, bucketMs, counts, maxCount } = useMemo(() => {
    const times = entries.map(tsMs).filter((n) => !Number.isNaN(n));
    const min = times.length ? Math.min(...times) : 0;
    const max = times.length ? Math.max(...times) : 0;
    const spanS = Math.max(1, Math.round((max - min) / 1000));
    const n = Math.min(60, Math.max(1, spanS));
    const size = Math.max(1, (max - min) / n) || 1;
    const c = new Array(n).fill(0);
    for (const e of kqlDocs) {
      const t = tsMs(e);
      if (Number.isNaN(t)) continue;
      const idx = Math.min(n - 1, Math.max(0, Math.floor((t - min) / size)));
      c[idx] += 1;
    }
    return { fullMin: min, fullMax: max, buckets: n, bucketMs: size, counts: c, maxCount: Math.max(1, ...c) };
  }, [entries, kqlDocs]);

  // Apply the brushed time window to the query results.
  const docs = useMemo(() => {
    if (!sel) return kqlDocs;
    return kqlDocs.filter((e) => { const t = tsMs(e); return t >= sel.start && t < sel.end; });
  }, [kqlDocs, sel]);

  const toggle = (i) => setExpanded((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const addField = (f) => setQuery((q) => (q.trim() ? `${q.trim()} and ${f}:` : `${f}:`));

  const onUp = () => {
    if (!drag) return;
    const lo = Math.min(drag.a, drag.b), hi = Math.max(drag.a, drag.b);
    setSel({ start: fullMin + lo * bucketMs, end: fullMin + (hi + 1) * bucketMs });
    setDrag(null);
  };
  const inActive = (i) => {
    if (drag) return i >= Math.min(drag.a, drag.b) && i <= Math.max(drag.a, drag.b);
    if (sel) { const s = fullMin + i * bucketMs; return s >= sel.start && s < sel.end; }
    return true;
  };

  const Title = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <Icon name="ScrollText" size={18} style={{ color: 'var(--text-secondary)' }} />
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Logs · Discover</h2>
        <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Search with KQL · brush the histogram to filter by time{run.status === 'PAUSED' ? ' · paused' : ''}</div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-inset)', border: '1px solid ' + (error ? 'var(--status-danger, #ef4444)' : 'var(--border-default)') }}>
          <Icon name="Search" size={15} style={{ color: 'var(--text-tertiary)' }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={'event.action:process_start and host.name:win-ep-04'} spellCheck={false}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13 }} />
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: 4 }}>KQL</span>
          {query && <AC.IconButton label="Clear" onClick={() => setQuery('')}><Icon name="X" size={14} /></AC.IconButton>}
        </div>
        <AC.IconButton label={showFields ? 'Hide fields' : 'Show fields'} onClick={() => setShowFields((v) => !v)}><Icon name="Columns3" size={16} /></AC.IconButton>
      </div>

      {/* Histogram (graph timeline) + time controller */}
      <AC.Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {error ? <span style={{ color: 'var(--status-danger, #ef4444)' }}>{error}</span> : <><strong style={{ color: 'var(--text-secondary)' }}>{docs.length}</strong> hits</>}
          </span>
          {sel ? (
            <button onClick={() => setSel(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent-subtle-bg, rgba(124,140,255,0.12))', border: '1px solid var(--accent-subtle-border, rgba(124,140,255,0.3))', borderRadius: 999, padding: '3px 10px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>
              <Icon name="Clock" size={12} /> {hhmmss(sel.start)} → {hhmmss(sel.end)} <Icon name="X" size={12} />
            </button>
          ) : (
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{hhmmss(fullMin)} → {hhmmss(fullMax)}</span>
          )}
        </div>
        <div
          onMouseUp={onUp}
          onMouseLeave={() => setDrag(null)}
          style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 64, cursor: 'crosshair', userSelect: 'none' }}
        >
          {counts.map((c, i) => (
            <div
              key={i}
              onMouseDown={() => setDrag({ a: i, b: i })}
              onMouseEnter={() => setDrag((d) => (d ? { ...d, b: i } : d))}
              title={`${hhmmss(fullMin + i * bucketMs)} · ${c} event${c === 1 ? '' : 's'}`}
              style={{ flex: 1, minWidth: 2, height: `${Math.max(c ? 6 : 0, (c / maxCount) * 100)}%`, background: inActive(i) ? 'var(--accent, #7c8cff)' : 'var(--border-strong, var(--border-default))', opacity: inActive(i) ? 0.85 : 0.4, borderRadius: '2px 2px 0 0' }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          <span>{hhmmss(fullMin)}</span>
          <span>{hhmmss(fullMin + (fullMax - fullMin) / 2)}</span>
          <span>{hhmmss(fullMax)}</span>
        </div>
      </AC.Card>

      <div style={{ height: 12 }} />

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
              <div style={{ padding: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>No events match{sel ? ' in this time window' : ''}.</div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border-default)', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                  <span style={{ width: 26 }} /><span style={{ width: 165 }}>Time</span><span>Document</span>
                </div>
                {docs.map((e, i) => {
                  const open = expanded.has(i);
                  const doc = ecsDoc(e);
                  return (
                    <div key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <button onClick={() => toggle(i)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={13} style={{ color: 'var(--text-tertiary)', flex: 'none', width: 16 }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)', flex: 'none', width: 165 }}>{e.ts}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>host.name</span>:<span style={{ color: 'var(--accent, #7c8cff)' }}>{e.host}</span>{' '}
                          <span style={{ color: 'var(--text-tertiary)' }}>event.action</span>:{e.action}{' '}
                          <span style={{ color: 'var(--text-tertiary)' }}>message</span>:{e.message}
                        </span>
                      </button>
                      {open && (
                        <div style={{ padding: '4px 12px 12px 38px', display: 'grid', gridTemplateColumns: '180px 1fr', gap: '3px 12px' }}>
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
