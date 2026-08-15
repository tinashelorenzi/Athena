'use client';
import React from 'react';

const CSS = `
.ath-switch{display:inline-flex;align-items:center;gap:10px;cursor:pointer;user-select:none;font-size:var(--fs-body);color:var(--text-primary);}
.ath-switch[data-disabled="true"]{opacity:.45;cursor:not-allowed;}
.ath-switch input{position:absolute;opacity:0;width:0;height:0;}
.ath-switch__track{
  width:38px;height:22px;flex:none;border-radius:var(--radius-pill);
  background:var(--gray-300);border:1px solid var(--border-default);position:relative;
  transition:background var(--dur-base) var(--ease-standard),border-color var(--dur-base) var(--ease-standard);
}
.ath-switch__thumb{
  position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;
  background:#fff;box-shadow:0 1px 2px rgba(16,24,40,0.25);transition:transform var(--dur-base) var(--ease-out),background var(--dur-base);
}
.ath-switch input:checked + .ath-switch__track{background:var(--brand);border-color:var(--brand);}
.ath-switch input:checked + .ath-switch__track .ath-switch__thumb{transform:translateX(16px);background:#fff;}
.ath-switch input:focus-visible + .ath-switch__track{box-shadow:var(--focus-ring);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'switch');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Switch({ label, checked, disabled = false, onChange, className = '', ...rest }) {
  inject();
  return (
    <label className={`ath-switch ${className}`} data-disabled={disabled}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={onChange} {...rest} />
      <span className="ath-switch__track" aria-hidden="true"><span className="ath-switch__thumb" /></span>
      {label != null && <span>{label}</span>}
    </label>
  );
}
