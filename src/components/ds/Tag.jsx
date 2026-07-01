'use client';
import React from 'react';

const CSS = `
.ath-tag{
  display:inline-flex;align-items:center;gap:6px;
  font-family:var(--font-mono);font-size:var(--fs-mono-sm);
  background:var(--surface-raised);color:var(--text-secondary);
  border:1px solid var(--border-default);border-radius:var(--radius-xs);
  padding:3px 6px 3px 8px;white-space:nowrap;max-width:100%;
}
.ath-tag--filter{background:var(--brand-subtle-bg);border-color:var(--brand-subtle-border);color:var(--blue-200);}
.ath-tag__key{color:var(--syntax-field);}
.ath-tag__op{color:var(--syntax-operator);margin:0 1px;}
.ath-tag__val{color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;}
.ath-tag__x{
  display:flex;align-items:center;justify-content:center;flex:none;
  width:16px;height:16px;border-radius:var(--radius-xs);border:none;background:transparent;
  color:var(--text-tertiary);cursor:pointer;margin-left:1px;padding:0;
  transition:background var(--dur-fast),color var(--dur-fast);
}
.ath-tag__x:hover{background:var(--surface-selected);color:var(--sev-critical);}
.ath-tag__x svg{width:12px;height:12px;}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'tag');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Tag({ field, op = ':', value, filter = false, onRemove, children, className = '', ...rest }) {
  inject();
  const cls = ['ath-tag', filter ? 'ath-tag--filter' : '', className].filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      {field != null ? (
        <span>
          <span className="ath-tag__key">{field}</span>
          <span className="ath-tag__op">{op}</span>
          <span className="ath-tag__val">{value}</span>
        </span>
      ) : children}
      {onRemove && (
        <button type="button" className="ath-tag__x" aria-label="Remove filter" onClick={onRemove}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
        </button>
      )}
    </span>
  );
}
