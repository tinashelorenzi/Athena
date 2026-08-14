'use client';
import React, { useState } from 'react';
import alasql from 'alasql';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';

/* OSQuery SQL console. osquery is SQLite under the hood, so students query the
   endpoint's tables with real SQL (via alasql) instead of reading a dump. */
export function OSQueryPanel({ endpoints }) {
  const hosts = (endpoints || []).filter((e) => e.osquery?.tables && Object.keys(e.osquery.tables).length);
  const [hostId, setHostId] = useState(hosts[0]?.id ?? null);
  const ep = hosts.find((e) => e.id === hostId) || hosts[0];
  const tables = ep?.osquery?.tables || {};
  const tableNames = Object.keys(tables);
  const [sql, setSql] = useState(tableNames[0] ? `SELECT * FROM ${tableNames[0]}` : 'SELECT 1');
  const [result, setResult] = useState(null); // { cols, rows } | { error }

  const runQuery = (q) => {
    const query = q ?? sql;
    try {
      const db = new alasql.Database();
      for (const [name, rows] of Object.entries(tables)) {
        db.exec(`CREATE TABLE \`${name}\``);
        db.tables[name].data = Array.isArray(rows) ? rows : [];
      }
      const rows = db.exec(query);
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
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>OSQuery</h2>
        <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Query the endpoint with SQL, just like osquery.</div>
      </div>
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

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* table catalog */}
        <div style={{ width: 190, flex: 'none' }}>
          <AC.Card padded={false}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Tables</div>
            <div style={{ maxHeight: 420, overflow: 'auto', padding: 6 }}>
              {tableNames.map((t) => (
                <button key={t} onClick={() => { setSql(`SELECT * FROM ${t}`); runQuery(`SELECT * FROM ${t}`); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}><Icon name="Table2" size={12} style={{ color: 'var(--text-tertiary)', flex: 'none' }} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</span></span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{Array.isArray(tables[t]) ? tables[t].length : 0}</span>
                </button>
              ))}
            </div>
          </AC.Card>
        </div>

        {/* editor + results */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runQuery(); } }}
              rows={3}
              spellCheck={false}
              style={{ width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-inset)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.5 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AC.Button variant="primary" size="sm" leadingIcon={<Icon name="Play" size={13} />} onClick={() => runQuery()}>Run query</AC.Button>
              <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>⌘/Ctrl + Enter</span>
              {result && !result.error && <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{result.rows.length} row{result.rows.length === 1 ? '' : 's'}</span>}
            </div>
          </div>

          <AC.Card padded={false}>
            {!result ? (
              <div style={{ padding: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>Run a query to see results.</div>
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
    </div>
  );
}

export default OSQueryPanel;
