'use client';
import React from 'react';

const CSS = `
.ath-selwrap{display:flex;flex-direction:column;gap:6px;}
.ath-selwrap__label{font-size:var(--fs-body-sm);font-weight:var(--fw-medium);color:var(--text-secondary);}
.ath-sel{position:relative;display:flex;align-items:center;}
.ath-sel select{
  appearance:none;-webkit-appearance:none;width:100%;
  background:var(--surface-inset);color:var(--text-primary);
  border:1px solid var(--border-default);border-radius:var(--radius-sm);
  font-family:var(--font-sans);font-size:var(--fs-body);
  padding:0 32px 0 10px;cursor:pointer;
  transition:border-color var(--dur-fast) var(--ease-standard),box-shadow var(--dur-fast) var(--ease-standard);
}
.ath-sel--sm select{height:var(--control-h-sm);}
.ath-sel--md select{height:var(--control-h-md);}
.ath-sel--lg select{height:var(--control-h-lg);}
.ath-sel select:hover{border-color:var(--border-strong);}
.ath-sel select:focus-visible{outline:none;border-color:var(--border-focus);box-shadow:0 0 0 3px rgba(84,87,232,.25);}
.ath-sel select:disabled{opacity:.5;cursor:not-allowed;}
.ath-sel__chev{position:absolute;right:10px;pointer-events:none;color:var(--text-tertiary);display:flex;}
.ath-sel__chev svg{width:16px;height:16px;}
.ath-sel select option{background:var(--surface-card);color:var(--text-primary);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'select');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Select({ label, size = 'md', options = [], children, id, className = '', ...rest }) {
  inject();
  const fieldId = id || (label ? `s-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const control = (
    <div className={`ath-sel ath-sel--${size} ${className}`}>
      <select id={fieldId} {...rest}>
        {options.map((o) => {
          const val = typeof o === 'object' ? o.value : o;
          const lbl = typeof o === 'object' ? o.label : o;
          return <option key={val} value={val}>{lbl}</option>;
        })}
        {children}
      </select>
      <span className="ath-sel__chev" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </span>
    </div>
  );
  if (!label) return control;
  return (
    <div className="ath-selwrap">
      <label className="ath-selwrap__label" htmlFor={fieldId}>{label}</label>
      {control}
    </div>
  );
}
