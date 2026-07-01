'use client';
import React from 'react';

const CSS = `
.ath-stat{
  display:flex;flex-direction:column;gap:8px;
  background:var(--surface-card);border:1px solid var(--border-default);
  border-radius:var(--radius-md);padding:16px 18px;box-shadow:var(--edge-highlight);position:relative;
}
.ath-stat__top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.ath-stat__label{font-size:var(--fs-caption);font-weight:var(--fw-semibold);letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--text-tertiary);}
.ath-stat__icon{display:flex;color:var(--text-tertiary);}
.ath-stat__icon svg{width:16px;height:16px;}
.ath-stat__value{font-family:var(--font-mono);font-weight:var(--fw-semibold);font-size:28px;line-height:1;color:var(--text-primary);letter-spacing:-.01em;}
.ath-stat__foot{display:flex;align-items:center;gap:6px;font-size:var(--fs-caption);color:var(--text-tertiary);}
.ath-stat__delta{display:inline-flex;align-items:center;gap:3px;font-weight:var(--fw-semibold);}
.ath-stat__delta svg{width:13px;height:13px;}
.ath-stat__delta--up{color:var(--sev-critical);}
.ath-stat__delta--down{color:var(--status-success);}
.ath-stat__delta--flat{color:var(--text-tertiary);}
.ath-stat--accent .ath-stat__value{color:var(--accent);}
.ath-stat--critical{border-color:var(--sev-critical-border);}
.ath-stat--critical .ath-stat__value{color:var(--sev-critical);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'statcard');
  s.textContent = CSS;
  document.head.appendChild(s);
}

const ARROWS = {
  up: <polyline points="6 15 12 9 18 15" />,
  down: <polyline points="6 9 12 15 18 9" />,
  flat: <line x1="5" y1="12" x2="19" y2="12" />,
};

export function StatCard({ label, value, icon, delta, deltaDir = 'flat', hint, tone = 'default', className = '', ...rest }) {
  inject();
  const cls = ['ath-stat', tone !== 'default' ? `ath-stat--${tone}` : '', className].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      <div className="ath-stat__top">
        <span className="ath-stat__label">{label}</span>
        {icon && <span className="ath-stat__icon">{icon}</span>}
      </div>
      <div className="ath-stat__value">{value}</div>
      {(delta != null || hint) && (
        <div className="ath-stat__foot">
          {delta != null && (
            <span className={`ath-stat__delta ath-stat__delta--${deltaDir}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{ARROWS[deltaDir]}</svg>
              {delta}
            </span>
          )}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </div>
  );
}
