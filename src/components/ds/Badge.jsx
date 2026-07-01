'use client';
import React from 'react';

const CSS = `
.ath-badge{
  display:inline-flex;align-items:center;gap:5px;
  font-family:var(--font-sans);font-weight:var(--fw-semibold);
  font-size:var(--fs-caption);line-height:1;padding:3px 8px;
  border-radius:var(--radius-pill);border:1px solid transparent;white-space:nowrap;
}
.ath-badge--sq{border-radius:var(--radius-xs);}
.ath-badge__dot{width:6px;height:6px;border-radius:50%;flex:none;}
.ath-badge svg{width:12px;height:12px;}
.ath-badge--neutral{background:var(--ink-750);color:var(--text-secondary);border-color:var(--border-default);}
.ath-badge--neutral .ath-badge__dot{background:var(--ink-400);}
.ath-badge--brand{background:var(--brand-subtle-bg);color:var(--blue-300);border-color:var(--brand-subtle-border);}
.ath-badge--brand .ath-badge__dot{background:var(--brand-strong);}
.ath-badge--accent{background:var(--accent-subtle-bg);color:var(--yellow-400);border-color:var(--accent-subtle-border);}
.ath-badge--accent .ath-badge__dot{background:var(--accent);}
.ath-badge--success{background:var(--status-success-bg);color:var(--status-success);border-color:var(--status-success-border);}
.ath-badge--success .ath-badge__dot{background:var(--status-success);}
.ath-badge--warning{background:var(--status-warning-bg);color:var(--yellow-400);border-color:var(--accent-subtle-border);}
.ath-badge--warning .ath-badge__dot{background:var(--status-warning);}
.ath-badge--danger{background:var(--status-danger-bg);color:var(--sev-critical);border-color:var(--sev-critical-border);}
.ath-badge--danger .ath-badge__dot{background:var(--status-danger);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'badge');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Badge({ tone = 'neutral', square = false, dot = false, icon = null, children, className = '', ...rest }) {
  inject();
  const cls = ['ath-badge', `ath-badge--${tone}`, square ? 'ath-badge--sq' : '', className].filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      {dot && <span className="ath-badge__dot" aria-hidden="true" />}
      {icon}
      {children}
    </span>
  );
}
