'use client';
import React from 'react';

const CSS = `
.ath-dialog__overlay{
  position:fixed;inset:0;z-index:var(--z-modal);
  background:var(--surface-overlay);backdrop-filter:blur(var(--blur-overlay));-webkit-backdrop-filter:blur(var(--blur-overlay));
  display:flex;align-items:center;justify-content:center;padding:24px;
  animation:ath-dialog-fade var(--dur-base) var(--ease-standard);
}
@keyframes ath-dialog-fade{from{opacity:0;}to{opacity:1;}}
.ath-dialog{
  width:100%;max-height:calc(100vh - 48px);display:flex;flex-direction:column;
  background:var(--surface-card);border:1px solid var(--border-strong);
  border-radius:var(--radius-lg);box-shadow:var(--shadow-xl),var(--edge-highlight);overflow:hidden;
  animation:ath-dialog-pop var(--dur-base) var(--ease-out);
}
@keyframes ath-dialog-pop{from{opacity:0;transform:translateY(8px) scale(.99);}to{opacity:1;transform:none;}}
.ath-dialog--sm{max-width:420px;}
.ath-dialog--md{max-width:560px;}
.ath-dialog--lg{max-width:760px;}
.ath-dialog__header{display:flex;align-items:flex-start;gap:12px;padding:18px 20px;border-bottom:1px solid var(--border-subtle);}
.ath-dialog__titles{flex:1;min-width:0;}
.ath-dialog__title{font-size:var(--fs-h3);font-weight:var(--fw-semibold);color:var(--text-primary);margin:0;}
.ath-dialog__desc{font-size:var(--fs-body-sm);color:var(--text-tertiary);margin:4px 0 0;line-height:var(--lh-normal);}
.ath-dialog__x{flex:none;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-sm);border:none;background:transparent;color:var(--text-tertiary);cursor:pointer;transition:background var(--dur-fast),color var(--dur-fast);}
.ath-dialog__x:hover{background:var(--surface-hover);color:var(--text-primary);}
.ath-dialog__x svg{width:18px;height:18px;}
.ath-dialog__body{padding:20px;overflow-y:auto;color:var(--text-secondary);font-size:var(--fs-body);}
.ath-dialog__footer{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid var(--border-subtle);background:var(--surface-panel);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'dialog');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Dialog({ open = true, title, description, icon, size = 'md', onClose, footer, children, className = '', ...rest }) {
  inject();
  if (!open) return null;
  return (
    <div className="ath-dialog__overlay" onClick={onClose}>
      <div className={`ath-dialog ath-dialog--${size} ${className}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} {...rest}>
        {(title || onClose) && (
          <div className="ath-dialog__header">
            {icon}
            <div className="ath-dialog__titles">
              {title && <h2 className="ath-dialog__title">{title}</h2>}
              {description && <p className="ath-dialog__desc">{description}</p>}
            </div>
            {onClose && (
              <button className="ath-dialog__x" aria-label="Close" onClick={onClose}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
              </button>
            )}
          </div>
        )}
        <div className="ath-dialog__body">{children}</div>
        {footer && <div className="ath-dialog__footer">{footer}</div>}
      </div>
    </div>
  );
}
