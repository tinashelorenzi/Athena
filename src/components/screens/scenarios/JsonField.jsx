'use client';
import React, { useState } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { Textarea } from './primitives';
import { EXAMPLES } from './scenario-examples';

/* A JSON data section for the scenario builder: label + file upload + a
   collapsible, copyable example + a textarea. `name` is the base key; the
   textarea posts as `${name}Json` and the file as `${name}File` (matching the
   server actions). `example` selects an entry from EXAMPLES. */
export function JsonField({ label, name, placeholder, hint, example, defaultValue = '', rows = 5 }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ex = example ? EXAMPLES[example] : null;

  const copy = async () => {
    if (!ex) return;
    try { await navigator.clipboard.writeText(ex); setCopied(true); } catch { /* clipboard blocked */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {ex && (
            <button
              type="button"
              onClick={() => { setOpen((o) => !o); setCopied(false); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent, #7c8cff)', fontSize: 12 }}
            >
              <Icon name="Lightbulb" size={13} /> {open ? 'Hide example' : 'Show example'}
            </button>
          )}
          <input type="file" name={`${name}File`} accept="application/json,.json" style={{ fontSize: 12, color: 'var(--text-tertiary)' }} />
        </div>
      </div>

      {open && ex && (
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 8px 6px 12px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Example</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <AC.Button type="button" variant="ghost" size="sm" leadingIcon={<Icon name={copied ? 'Check' : 'Copy'} size={13} />} onClick={copy}>{copied ? 'Copied' : 'Copy'}</AC.Button>
              <AC.Button type="button" variant="secondary" size="sm" leadingIcon={<Icon name="CornerDownLeft" size={13} />} onClick={() => setValue(ex)}>Use this</AC.Button>
            </div>
          </div>
          <pre style={{ margin: 0, padding: '10px 12px', maxHeight: 240, overflow: 'auto', background: 'var(--surface-inset)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ex}</pre>
        </div>
      )}

      <Textarea name={`${name}Json`} mono rows={rows} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
      {hint && <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{hint}</span>}
    </div>
  );
}

export default JsonField;
