'use client';
import React from 'react';

const CSS = `
.ath-toast{
  display:flex;align-items:flex-start;gap:11px;width:100%;max-width:400px;
  background:var(--surface-card);border:1px solid var(--border-strong);
  border-left:3px solid var(--border-strong);border-radius:var(--radius-md);
  padding:13px 14px;box-shadow:var(--shadow-lg),var(--edge-highlight);
  animation:ath-toast-in var(--dur-base) var(--ease-out);
}
@keyframes ath-toast-in{from{opacity:0;transform:translateX(12px);}to{opacity:1;transform:none;}}
.ath-toast__icon{flex:none;display:flex;margin-top:1px;}
.ath-toast__icon svg{width:18px;height:18px;}
.ath-toast__body{flex:1;min-width:0;}
.ath-toast__title{font-size:var(--fs-body-sm);font-weight:var(--fw-semibold);color:var(--text-primary);margin:0;}
.ath-toast__msg{font-size:var(--fs-caption);color:var(--text-tertiary);margin:3px 0 0;line-height:var(--lh-normal);}
.ath-toast__x{flex:none;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-xs);border:none;background:transparent;color:var(--text-tertiary);cursor:pointer;}
.ath-toast__x:hover{background:var(--surface-hover);color:var(--text-primary);}
.ath-toast__x svg{width:14px;height:14px;}
.ath-toast--success{border-left-color:var(--status-success);}
.ath-toast--success .ath-toast__icon{color:var(--status-success);}
.ath-toast--danger{border-left-color:var(--sev-critical);}
.ath-toast--danger .ath-toast__icon{color:var(--sev-critical);}
.ath-toast--warning{border-left-color:var(--accent);}
.ath-toast--warning .ath-toast__icon{color:var(--accent);}
.ath-toast--info{border-left-color:var(--brand-strong);}
.ath-toast--info .ath-toast__icon{color:var(--brand-strong);}
`;

const ICONS = {
  success: <polyline points="20 6 9 17 4 12" />,
  danger: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
  warning: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
};

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'toast');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Toast({ tone = 'info', title, message, onClose, className = '', ...rest }) {
  inject();
  return (
    <div className={`ath-toast ath-toast--${tone} ${className}`} role="status" {...rest}>
      <span className="ath-toast__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[tone]}</svg>
      </span>
      <div className="ath-toast__body">
        {title && <p className="ath-toast__title">{title}</p>}
        {message && <p className="ath-toast__msg">{message}</p>}
      </div>
      {onClose && (
        <button className="ath-toast__x" aria-label="Dismiss" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
        </button>
      )}
    </div>
  );
}
