'use client';
import React from 'react';

const CSS = `
.ath-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px 24px;gap:14px;}
.ath-empty__icon{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:var(--radius-lg);background:var(--surface-raised);border:1px solid var(--border-default);color:var(--text-tertiary);}
.ath-empty__icon svg{width:26px;height:26px;stroke-width:1.6;}
.ath-empty__title{font-size:var(--fs-h3);font-weight:var(--fw-semibold);color:var(--text-primary);margin:0;}
.ath-empty__desc{font-size:var(--fs-body-sm);color:var(--text-tertiary);max-width:360px;margin:0;line-height:var(--lh-normal);}
.ath-empty__actions{display:flex;gap:10px;margin-top:4px;}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'empty');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function EmptyState({ icon, title, description, actions, className = '', ...rest }) {
  inject();
  return (
    <div className={`ath-empty ${className}`} {...rest}>
      {icon && <div className="ath-empty__icon">{icon}</div>}
      {title && <h3 className="ath-empty__title">{title}</h3>}
      {description && <p className="ath-empty__desc">{description}</p>}
      {actions && <div className="ath-empty__actions">{actions}</div>}
    </div>
  );
}
