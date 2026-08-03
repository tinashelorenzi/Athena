'use client';
import React from 'react';

/* Small shared authoring primitives, extracted so both ScenarioFields and
   JsonField can use them without a circular import. */

export function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>}
      {children}
      {hint && <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{hint}</span>}
    </div>
  );
}

export function Textarea({ mono, rows = 4, ...rest }) {
  return (
    <textarea
      rows={rows}
      spellCheck={false}
      style={{
        width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-inset)', border: '1px solid var(--border-default)', color: 'var(--text-primary)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: 13, lineHeight: 1.5,
      }}
      {...rest}
    />
  );
}
