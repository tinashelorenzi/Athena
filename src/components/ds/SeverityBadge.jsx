'use client';
import React from 'react';

const CSS = `
.ath-sev{
  display:inline-flex;align-items:center;gap:6px;
  font-family:var(--font-sans);font-weight:var(--fw-semibold);
  font-size:var(--fs-micro);letter-spacing:var(--ls-caps);text-transform:uppercase;
  padding:3px 8px 3px 7px;border-radius:var(--radius-xs);border:1px solid;white-space:nowrap;line-height:1;
}
.ath-sev__dot{width:7px;height:7px;border-radius:50%;flex:none;}
.ath-sev--critical{color:var(--sev-critical);background:var(--sev-critical-bg);border-color:var(--sev-critical-border);}
.ath-sev--critical .ath-sev__dot{background:var(--sev-critical);box-shadow:0 0 6px var(--sev-critical);}
.ath-sev--high{color:var(--sev-high);background:var(--sev-high-bg);border-color:var(--sev-high-border);}
.ath-sev--high .ath-sev__dot{background:var(--sev-high);}
.ath-sev--medium{color:var(--sev-medium);background:var(--sev-medium-bg);border-color:var(--sev-medium-border);}
.ath-sev--medium .ath-sev__dot{background:var(--sev-medium);}
.ath-sev--low{color:var(--sev-low);background:var(--sev-low-bg);border-color:var(--sev-low-border);}
.ath-sev--low .ath-sev__dot{background:var(--sev-low);}
.ath-sev--info{color:var(--sev-info);background:var(--sev-info-bg);border-color:var(--sev-info-border);}
.ath-sev--info .ath-sev__dot{background:var(--sev-info);}
.ath-sev--solid.ath-sev--critical{background:var(--sev-critical);color:#fff;border-color:transparent;}
.ath-sev--solid.ath-sev--high{background:var(--sev-high);color:#1a0f00;border-color:transparent;}
.ath-sev--solid.ath-sev--medium{background:var(--sev-medium);color:#1a1400;border-color:transparent;}
.ath-sev--solid.ath-sev--low{background:var(--sev-low);color:#0a0b14;border-color:transparent;}
.ath-sev--solid.ath-sev--info{background:var(--sev-info);color:#fff;border-color:transparent;}
.ath-sev--solid .ath-sev__dot{display:none;}
@keyframes ath-sev-pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
.ath-sev--critical.ath-sev--pulse .ath-sev__dot{animation:ath-sev-pulse 1.6s var(--ease-standard) infinite;}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'severity');
  s.textContent = CSS;
  document.head.appendChild(s);
}

const LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };

export function SeverityBadge({ level = 'info', solid = false, pulse = false, children, className = '', ...rest }) {
  inject();
  const cls = [
    'ath-sev',
    `ath-sev--${level}`,
    solid ? 'ath-sev--solid' : '',
    pulse ? 'ath-sev--pulse' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      <span className="ath-sev__dot" aria-hidden="true" />
      {children ?? LABELS[level] ?? level}
    </span>
  );
}
