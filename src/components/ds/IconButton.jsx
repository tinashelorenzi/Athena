'use client';
import React from 'react';

const CSS = `
.ath-iconbtn{
  display:inline-flex;align-items:center;justify-content:center;flex:none;
  border-radius:var(--radius-sm);border:1px solid transparent;cursor:pointer;
  color:var(--text-secondary);background:transparent;
  transition:background var(--dur-fast) var(--ease-standard),
             color var(--dur-fast) var(--ease-standard),
             border-color var(--dur-fast) var(--ease-standard),
             box-shadow var(--dur-fast) var(--ease-standard);
}
.ath-iconbtn:hover:not([disabled]){background:var(--surface-hover);color:var(--text-primary);}
.ath-iconbtn:active:not([disabled]){background:var(--surface-card);}
.ath-iconbtn:focus-visible{outline:none;box-shadow:var(--focus-ring);}
.ath-iconbtn[disabled]{cursor:not-allowed;opacity:.4;}
.ath-iconbtn svg{width:1.15em;height:1.15em;}

.ath-iconbtn--sm{width:var(--control-h-sm);height:var(--control-h-sm);font-size:var(--fs-body-sm);}
.ath-iconbtn--md{width:var(--control-h-md);height:var(--control-h-md);font-size:var(--fs-body);}
.ath-iconbtn--lg{width:var(--control-h-lg);height:var(--control-h-lg);font-size:var(--fs-body-lg);}

.ath-iconbtn--solid{background:var(--surface-raised);border-color:var(--border-default);}
.ath-iconbtn--solid:hover:not([disabled]){border-color:var(--border-strong);}
.ath-iconbtn--active{background:var(--brand-subtle-bg);color:var(--brand-strong);border-color:var(--brand-subtle-border);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'iconbutton');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function IconButton({
  size = 'md',
  variant = 'ghost',
  active = false,
  disabled = false,
  label,
  children,
  className = '',
  ...rest
}) {
  inject();
  const cls = [
    'ath-iconbtn',
    `ath-iconbtn--${size}`,
    variant === 'solid' ? 'ath-iconbtn--solid' : '',
    active ? 'ath-iconbtn--active' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={disabled} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}
