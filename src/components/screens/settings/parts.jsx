'use client';
import React from 'react';
import { Icon } from '@/components/Icon';

/* Shared bits for the settings sections. */

export function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
        <Icon name={icon} size={17} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{subtitle}</div>
      </div>
    </div>
  );
}

export function FormStatus({ state }) {
  if (state?.error) {
    return (
      <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--status-danger, #ef4444)' }}>
        <Icon name="TriangleAlert" size={15} /> {state.error}
      </div>
    );
  }
  if (state?.ok) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--status-success, #22c55e)' }}>
        <Icon name="CircleCheck" size={15} /> {state.ok}
      </div>
    );
  }
  return null;
}

export function ToggleRow({ label, hint, checked, onToggle, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}
