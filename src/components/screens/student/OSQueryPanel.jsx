'use client';
import React, { useMemo, useState } from 'react';
import alasql from 'alasql';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';

/* OSQuery SQL console. osquery is SQLite under the hood, so students write real
   SQL against the endpoint's tables. No query is written for them — a lightbulb
   reveals the schema (tables + columns) as a reference; the rest is on them. */
export function OSQueryPanel({ endpoints }) {
  const hosts = (endpoints || []).filter((e) => e.osquery?.tables && Object.keys(e.osquery.tables).length);
  const [hostId, setHostId] = useState(hosts[0]?.id ?? null);
  const ep = hosts.find((e) => e.id === hostId) || hosts[0];
  const tables = ep?.osquery?.tables || {};
  const [sql, setSql] = useState('');
  const [result, setResult] = useState(null);   // { cols, rows } | { error }
  const [showSchema, setShowSchema] = useState(false);

  const schema = useMemo(() => Object.entries(tables).map(([name, rows]) => {
    const list = Array.isArray(rows) ? rows : [];
    const cols = [...new Set(list.flatMap((r) => Object.keys(r || {})))];
    const types = Object.fromEntries(cols.map((c) => {
      const v = list.find((r) => r && r[c] != null)?.[c];
      return [c, typeof v === 'number' ? 'INTEGER' : 'TEXT'];
    }));
    return { name, count: list.length, cols, types };
  }), [tables]);

  const runQuery = () => {
    const q = sql.trim();
    if (!q) { setResult({ error: 'Write a query first.' }); return; }
    try {
      const db = new alasql.Database();
      for (const [name, rows] of Object.entries(tables)) {
        db.exec(`CREATE TABLE \`${name}\``);
        db.tables[name].data = Array.isArray(rows) ? rows : [];
      }
      const rows = db.exec(q);
      const list = Array.isArray(rows) ? rows : [];
      const cols = list.length ? [...new Set(list.flatMap((r) => Object.keys(r || {})))] : [];
      setResult({ cols, rows: list });
    } catch (e) {
      setResult({ error: e?.message || 'Query error' });
    }
  };

  const Title = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <Icon name="TerminalSquare" size={18} style={{ color: 'var(--text-secondary)' }} />
      <div style={{ flex: 1 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>OSQuery</h2>
        <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Query the endpoint with SQL, just like osquery.</div>
      </div>
      {hosts.length > 0 && (
        <AC.Button variant={showSchema ? 'secondary' : 'ghost'} size="sm" leadingIcon={<Icon name="Lightbulb" size={14} />} onClick={() => setShowSchema((v) => !v)}>Schema</AC.Button>
      )}
    </div>
  );

  if (hosts.length === 0) {
    return <div>{Title}<AC.Card><span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No OSQuery data in this scenario.</span></AC.Card></div>;
  }

  return (
    <div>
      {Title}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {hosts.map((e) => (
          <button key={e.id} onClick={() => { setHostId(e.id); setResult(null); }} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12.5,
            background: e.id === ep.id ? 'var(--surface-raised)' : 'var(--surface-inset)',
            border: '1px solid ' + (e.id === ep.id ? 'var(--border-default)' : 'var(--border-subtle)'),
            color: e.id === ep.id ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}><Icon name="Server" size={13} /> {e.hostname}</button>
        ))}
      </div>

      {showSchema && (
        <AC.Card header={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="Lightbulb" size={15} style={{ color: 'var(--accent, #7c8cff)' }} /><span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Schema · {ep.hostname}</span></div>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {schema.map((t) => (
              <div key={t.name}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', marginBottom: 5 }}>{t.name} <span style={{ color: 'var(--text-tertiary)', fontSize: 11.5 }}>· {t.count} row{t.count === 1 ? '' : 's'}</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {t.cols.map((c) => (
                    <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-secondary)', background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', borderRadius: 5, padding: '2px 7px' }}>
                      {c} <span style={{ color: 'var(--text-tertiary)' }}>{t.types[c]}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </AC.Card>
      )}

      <div style={{ height: showSchema ? 12 : 0 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runQuery(); } }}
          rows={3}
          spellCheck={false}
          placeholder={'SELECT name, path, pid FROM processes WHERE on_disk = 1'}
          style={{ width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-inset)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.5 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AC.Button variant="primary" size="sm" leadingIcon={<Icon name="Play" size={13} />} onClick={runQuery}>Run query</AC.Button>
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>⌘/Ctrl + Enter</span>
          {result && !result.error && <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{result.rows.length} row{result.rows.length === 1 ? '' : 's'}</span>}
        </div>

        <AC.Card padded={false}>
          {!result ? (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>Write a query and run it. Click <strong style={{ color: 'var(--text-secondary)' }}>Schema</strong> if you need the table + column names.</div>
          ) : result.error ? (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--status-danger, #ef4444)', display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="TriangleAlert" size={15} /> {result.error}</div>
          ) : result.rows.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>No rows.</div>
          ) : (
            <div style={{ overflow: 'auto', maxHeight: 460 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                <thead><tr>{result.cols.map((c) => <th key={c} style={{ position: 'sticky', top: 0, background: 'var(--surface-raised)', textAlign: 'left', padding: '7px 10px', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap', fontWeight: 600 }}>{c}</th>)}</tr></thead>
                <tbody>{result.rows.map((r, i) => (<tr key={i}>{result.cols.map((c) => <td key={c} style={{ padding: '6px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>{r[c] === null || r[c] === undefined ? '—' : typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c])}</td>)}</tr>))}</tbody>
              </table>
            </div>
          )}
        </AC.Card>
      </div>
    </div>
  );
}

export default OSQueryPanel;
