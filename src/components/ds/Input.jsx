'use client';
import React from 'react';

const CSS = `
.ath-field{display:flex;flex-direction:column;gap:6px;}
.ath-field__label{font-size:var(--fs-body-sm);font-weight:var(--fw-medium);color:var(--text-secondary);}
.ath-field__hint{font-size:var(--fs-caption);color:var(--text-tertiary);}
.ath-field__hint--error{color:var(--sev-critical);}

.ath-inputwrap{
  display:flex;align-items:center;gap:8px;
  background:var(--surface-inset);border:1px solid var(--border-default);
  border-radius:var(--radius-sm);padding:0 10px;
  transition:border-color var(--dur-fast) var(--ease-standard),box-shadow var(--dur-fast) var(--ease-standard);
}
.ath-inputwrap:hover{border-color:var(--border-strong);}
.ath-inputwrap:focus-within{border-color:var(--border-focus);box-shadow:0 0 0 3px rgba(84,87,232,.25);}
.ath-inputwrap--error{border-color:var(--sev-critical);}
.ath-inputwrap--error:focus-within{box-shadow:0 0 0 3px rgba(255,77,94,.25);}
.ath-inputwrap--disabled{opacity:.5;pointer-events:none;}
.ath-inputwrap--sm{height:var(--control-h-sm);}
.ath-inputwrap--md{height:var(--control-h-md);}
.ath-inputwrap--lg{height:var(--control-h-lg);}
.ath-inputwrap--mono .ath-input{font-family:var(--font-mono);}

.ath-input{
  flex:1;min-width:0;border:none;outline:none;background:transparent;
  color:var(--text-primary);font-family:var(--font-sans);font-size:var(--fs-body);
}
.ath-input::placeholder{color:var(--text-tertiary);}
.ath-inputwrap__icon{display:flex;color:var(--text-tertiary);flex:none;}
.ath-inputwrap__icon svg{width:16px;height:16px;}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'input');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Input({
  label,
  hint,
  error,
  size = 'md',
  mono = false,
  disabled = false,
  leadingIcon = null,
  trailingIcon = null,
  id,
  className = '',
  ...rest
}) {
  inject();
  const fieldId = id || (label ? `f-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const wrapCls = [
    'ath-inputwrap',
    `ath-inputwrap--${size}`,
    error ? 'ath-inputwrap--error' : '',
    disabled ? 'ath-inputwrap--disabled' : '',
    mono ? 'ath-inputwrap--mono' : '',
    className,
  ].filter(Boolean).join(' ');
  const control = (
    <div className={wrapCls}>
      {leadingIcon && <span className="ath-inputwrap__icon">{leadingIcon}</span>}
      <input className="ath-input" id={fieldId} disabled={disabled} {...rest} />
      {trailingIcon && <span className="ath-inputwrap__icon">{trailingIcon}</span>}
    </div>
  );
  if (!label && !hint && !error) return control;
  return (
    <div className="ath-field">
      {label && <label className="ath-field__label" htmlFor={fieldId}>{label}</label>}
      {control}
      {(error || hint) && (
        <span className={`ath-field__hint ${error ? 'ath-field__hint--error' : ''}`}>
          {error || hint}
        </span>
      )}
    </div>
  );
}
