'use client';
import React from 'react';
import * as OS from '@/components/ds';
import { Icon } from '@/components/Icon';
import { AthenaData } from '@/lib/data';

/* OSQuery — run SQL against simulated endpoints. */
const SAVED = ['Running processes not on disk', 'Startup items', 'Logged-in users', 'Listening ports', 'Scheduled tasks', 'Recently modified files'];

export function OsqueryScreen() {
  const [sql, setSql] = React.useState("SELECT name, path, pid, uid, on_disk\nFROM processes\nWHERE on_disk = 1 AND path LIKE 'C:\\ProgramData%';");
  const res = AthenaData.osqueryResult;

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <aside style={{ width: 230, flex: 'none', borderRight: '1px solid var(--border-subtle)', background: 'var(--surface-panel)', overflow: 'auto', padding: '14px 10px' }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '4px 8px 8px' }}>Saved queries</div>
        {SAVED.map((s, i) => (
          <button key={s} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px', border: 'none', cursor: 'pointer', background: i === 0 ? 'var(--surface-hover)' : 'transparent', borderRadius: 'var(--radius-xs)', color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', textAlign: 'left', fontSize: 13 }}>
            <Icon name="FileTerminal" size={14} style={{ color: 'var(--text-tertiary)' }} />{s}
          </button>
        ))}
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
              <Icon name="Database" size={14} /> Target: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>win-ep-04</span>
            </div>
            <OS.Button variant="primary" size="sm" leadingIcon={<Icon name="Play" size={14} />}>Run query</OS.Button>
          </div>
          <div style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <textarea value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false} style={{
              width: '100%', minHeight: 96, resize: 'vertical', border: 'none', outline: 'none', background: 'transparent',
              color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6, padding: '12px 14px', display: 'block',
            }} />
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
            <Icon name="CircleCheck" size={14} style={{ color: 'var(--status-success)' }} />
            <span><strong style={{ color: 'var(--text-secondary)' }}>{res.length} rows</strong> · 42 ms</span>
          </div>
          <OS.Table rowKey="pid" compact
            columns={[
              { key: 'name', header: 'name', mono: true, primary: true },
              { key: 'path', header: 'path', mono: true },
              { key: 'pid', header: 'pid', mono: true, align: 'right', width: '80px' },
              { key: 'uid', header: 'uid', mono: true, width: '120px' },
              { key: 'on_disk', header: 'on_disk', mono: true, align: 'right', width: '90px' },
            ]}
            rows={res} />
        </div>
      </div>
    </div>
  );
}

export default OsqueryScreen;
