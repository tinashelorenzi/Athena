'use client';
import React from 'react';

const CSS = `
.ath-progress{width:100%;}
.ath-progress__head{display:flex;justify-content:space-between;font-size:var(--fs-caption);color:var(--text-tertiary);margin-bottom:6px;}
.ath-progress__head strong{color:var(--text-secondary);font-weight:var(--fw-semibold);}
.ath-progress__track{height:6px;background:var(--surface-inset);border-radius:var(--radius-pill);overflow:hidden;border:1px solid var(--border-subtle);}
.ath-progress__track--lg{height:10px;}
.ath-progress__bar{height:100%;border-radius:var(--radius-pill);background:var(--brand-strong);transition:width var(--dur-slow) var(--ease-out);}
.ath-progress__bar--accent{background:var(--accent);}
.ath-progress__bar--success{background:var(--status-success);}
.ath-progress__bar--critical{background:var(--sev-critical);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'progress');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function ProgressBar({ value = 0, max = 100, label, showValue = false, tone = 'brand', size = 'md', className = '', ...rest }) {
  inject();
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`ath-progress ${className}`} {...rest}>
      {(label || showValue) && (
        <div className="ath-progress__head">
          <span>{label}</span>
          {showValue && <strong>{Math.round(pct)}%</strong>}
        </div>
      )}
      <div className={`ath-progress__track ${size === 'lg' ? 'ath-progress__track--lg' : ''}`} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
        <div className={`ath-progress__bar ath-progress__bar--${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
