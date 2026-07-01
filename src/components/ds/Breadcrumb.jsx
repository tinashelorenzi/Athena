'use client';
import React from 'react';

const CSS = `
.ath-crumbs{display:flex;align-items:center;gap:6px;font-size:var(--fs-body-sm);color:var(--text-tertiary);flex-wrap:wrap;}
.ath-crumbs a,.ath-crumbs button{color:var(--text-tertiary);background:none;border:none;padding:0;cursor:pointer;font:inherit;text-decoration:none;transition:color var(--dur-fast);}
.ath-crumbs a:hover,.ath-crumbs button:hover{color:var(--text-secondary);text-decoration:none;}
.ath-crumbs__sep{color:var(--border-strong);display:flex;}
.ath-crumbs__sep svg{width:14px;height:14px;}
.ath-crumbs__current{color:var(--text-primary);font-weight:var(--fw-medium);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'breadcrumb');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Breadcrumb({ items = [], onNavigate, className = '', ...rest }) {
  inject();
  return (
    <nav className={`ath-crumbs ${className}`} aria-label="Breadcrumb" {...rest}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {last ? (
              <span className="ath-crumbs__current" aria-current="page">{it.label}</span>
            ) : (
              <button onClick={() => onNavigate && onNavigate(it.id ?? it.label)}>{it.label}</button>
            )}
            {!last && (
              <span className="ath-crumbs__sep" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
