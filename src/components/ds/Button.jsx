'use client';
import React from 'react';

const CSS = `
.ath-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  font-family:var(--font-sans);font-weight:var(--fw-semibold);
  border-radius:var(--radius-sm);border:1px solid transparent;
  cursor:pointer;white-space:nowrap;user-select:none;
  transition:background var(--dur-fast) var(--ease-standard),
             border-color var(--dur-fast) var(--ease-standard),
             box-shadow var(--dur-fast) var(--ease-standard),
             color var(--dur-fast) var(--ease-standard);
}
.ath-btn:focus-visible{outline:none;box-shadow:var(--focus-ring);}
.ath-btn[disabled]{cursor:not-allowed;opacity:.45;}
.ath-btn svg{width:1.15em;height:1.15em;flex:none;}

.ath-btn--sm{height:var(--control-h-sm);padding:0 10px;font-size:var(--fs-body-sm);}
.ath-btn--md{height:var(--control-h-md);padding:0 14px;font-size:var(--fs-body);}
.ath-btn--lg{height:var(--control-h-lg);padding:0 18px;font-size:var(--fs-body-lg);}
.ath-btn--block{width:100%;}

.ath-btn--primary{background:var(--brand);color:var(--text-on-brand);}
.ath-btn--primary:hover:not([disabled]){background:var(--brand-hover);}
.ath-btn--primary:active:not([disabled]){background:var(--brand-active);}

.ath-btn--accent{background:var(--accent);color:var(--text-on-accent);}
.ath-btn--accent:hover:not([disabled]){background:var(--accent-hover);}
.ath-btn--accent:active:not([disabled]){background:var(--accent-active);}

.ath-btn--secondary{background:var(--surface-raised);color:var(--text-primary);border-color:var(--border-default);}
.ath-btn--secondary:hover:not([disabled]){background:var(--surface-selected);border-color:var(--border-strong);}
.ath-btn--secondary:active:not([disabled]){background:var(--surface-card);}

.ath-btn--ghost{background:transparent;color:var(--text-secondary);}
.ath-btn--ghost:hover:not([disabled]){background:var(--surface-hover);color:var(--text-primary);}

.ath-btn--danger{background:var(--status-danger);color:#fff;}
.ath-btn--danger:hover:not([disabled]){background:#ff6472;}
.ath-btn--danger:active:not([disabled]){background:#e53d4d;}

.ath-btn--outline-danger{background:transparent;color:var(--sev-critical);border-color:var(--sev-critical-border);}
.ath-btn--outline-danger:hover:not([disabled]){background:var(--sev-critical-bg);}

.ath-btn__spin{width:1em;height:1em;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:ath-btn-spin .6s linear infinite;}
@keyframes ath-btn-spin{to{transform:rotate(360deg);}}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'button');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  leadingIcon = null,
  trailingIcon = null,
  children,
  className = '',
  ...rest
}) {
  inject();
  const cls = [
    'ath-btn',
    `ath-btn--${variant}`,
    `ath-btn--${size}`,
    block ? 'ath-btn--block' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading && <span className="ath-btn__spin" aria-hidden="true" />}
      {!loading && leadingIcon}
      {children != null && <span>{children}</span>}
      {!loading && trailingIcon}
    </button>
  );
}
