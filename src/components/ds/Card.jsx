'use client';
import React from 'react';

const CSS = `
.ath-card{
  background:var(--surface-card);border:1px solid var(--border-default);
  border-radius:var(--radius-md);box-shadow:var(--edge-highlight);
  overflow:hidden;
}
.ath-card--pad{padding:var(--pad-card);}
.ath-card--hover{transition:border-color var(--dur-fast) var(--ease-standard),background var(--dur-fast) var(--ease-standard),transform var(--dur-fast) var(--ease-standard);cursor:pointer;}
.ath-card--hover:hover{border-color:var(--border-strong);background:var(--surface-raised);}
.ath-card--accent{border-color:var(--accent-subtle-border);}
.ath-card__header{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:14px var(--pad-card);border-bottom:1px solid var(--border-subtle);
}
.ath-card__title{font-size:var(--fs-body);font-weight:var(--fw-semibold);color:var(--text-primary);margin:0;}
.ath-card__body{padding:var(--pad-card);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'card');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Card({ title, actions, hover = false, accent = false, padded = true, header, children, className = '', ...rest }) {
  inject();
  const hasHeader = title || actions || header;
  const cls = [
    'ath-card',
    hover ? 'ath-card--hover' : '',
    accent ? 'ath-card--accent' : '',
    !hasHeader && padded ? 'ath-card--pad' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      {hasHeader && (
        <div className="ath-card__header">
          {header || <h3 className="ath-card__title">{title}</h3>}
          {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
        </div>
      )}
      {hasHeader ? <div className={padded ? 'ath-card__body' : ''}>{children}</div> : children}
    </div>
  );
}
