'use client';
import React from 'react';

const CSS = `
.ath-check{display:inline-flex;align-items:center;gap:9px;cursor:pointer;user-select:none;font-size:var(--fs-body);color:var(--text-primary);}
.ath-check[data-disabled="true"]{opacity:.45;cursor:not-allowed;}
.ath-check__box{
  width:18px;height:18px;flex:none;border-radius:var(--radius-xs);
  border:1.5px solid var(--border-strong);background:var(--surface-inset);
  display:flex;align-items:center;justify-content:center;color:#fff;
  transition:background var(--dur-fast) var(--ease-standard),border-color var(--dur-fast) var(--ease-standard);
}
.ath-check:hover .ath-check__box{border-color:var(--brand-strong);}
.ath-check input{position:absolute;opacity:0;width:0;height:0;}
.ath-check input:checked + .ath-check__box{background:var(--brand);border-color:var(--brand);}
.ath-check input:indeterminate + .ath-check__box{background:var(--brand);border-color:var(--brand);}
.ath-check input:focus-visible + .ath-check__box{box-shadow:var(--focus-ring);}
.ath-check__box svg{width:13px;height:13px;stroke-width:3;opacity:0;transition:opacity var(--dur-fast);}
.ath-check input:checked + .ath-check__box svg,
.ath-check input:indeterminate + .ath-check__box svg{opacity:1;}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'checkbox');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Checkbox({ label, checked, indeterminate = false, disabled = false, onChange, className = '', ...rest }) {
  inject();
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <label className={`ath-check ${className}`} data-disabled={disabled}>
      <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={onChange} {...rest} />
      <span className="ath-check__box" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          {indeterminate ? <line x1="5" y1="12" x2="19" y2="12" /> : <polyline points="20 6 9 17 4 12" />}
        </svg>
      </span>
      {label != null && <span>{label}</span>}
    </label>
  );
}
