'use client';
import React from 'react';

const CSS = `
.ath-status{display:inline-flex;align-items:center;gap:7px;font-size:var(--fs-body-sm);color:var(--text-secondary);white-space:nowrap;}
.ath-status__dot{width:8px;height:8px;border-radius:50%;flex:none;position:relative;}
.ath-status__dot::after{content:'';position:absolute;inset:-3px;border-radius:50%;opacity:.35;background:inherit;}
.ath-status--online .ath-status__dot{background:var(--status-online);}
.ath-status--offline .ath-status__dot{background:var(--status-offline);}
.ath-status--offline .ath-status__dot::after{display:none;}
.ath-status--isolated .ath-status__dot{background:var(--status-isolated);}
.ath-status--warning .ath-status__dot{background:var(--status-warning);}
.ath-status--danger .ath-status__dot{background:var(--status-danger);}
@keyframes ath-status-ping{0%{transform:scale(.6);opacity:.5;}80%,100%{transform:scale(1.9);opacity:0;}}
.ath-status--online .ath-status__dot::after{animation:ath-status-ping 2s var(--ease-out) infinite;}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'statusdot');
  s.textContent = CSS;
  document.head.appendChild(s);
}

const LABELS = { online: 'Online', offline: 'Offline', isolated: 'Isolated', warning: 'Degraded', danger: 'Compromised' };

export function StatusDot({ status = 'offline', label, className = '', ...rest }) {
  inject();
  return (
    <span className={`ath-status ath-status--${status} ${className}`} {...rest}>
      <span className="ath-status__dot" aria-hidden="true" />
      {label !== false && <span>{label ?? LABELS[status]}</span>}
    </span>
  );
}
