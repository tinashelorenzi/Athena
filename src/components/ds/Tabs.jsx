'use client';
import React from 'react';

const CSS = `
.ath-tabs{display:flex;align-items:stretch;gap:2px;border-bottom:1px solid var(--border-default);}
.ath-tabs--pill{border-bottom:none;gap:4px;background:var(--surface-inset);padding:3px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);align-self:flex-start;}
.ath-tab{
  display:inline-flex;align-items:center;gap:7px;background:transparent;border:none;cursor:pointer;
  font-family:var(--font-sans);font-size:var(--fs-body-sm);font-weight:var(--fw-medium);
  color:var(--text-tertiary);padding:10px 14px;position:relative;white-space:nowrap;
  transition:color var(--dur-fast) var(--ease-standard);
}
.ath-tab:hover{color:var(--text-secondary);}
.ath-tab svg{width:15px;height:15px;}
.ath-tab::after{content:'';position:absolute;left:8px;right:8px;bottom:-1px;height:2px;background:var(--brand-strong);border-radius:2px 2px 0 0;transform:scaleX(0);transition:transform var(--dur-base) var(--ease-out);}
.ath-tab[aria-selected="true"]{color:var(--text-primary);}
.ath-tab[aria-selected="true"]::after{transform:scaleX(1);}
.ath-tab__count{font-family:var(--font-mono);font-size:var(--fs-micro);background:var(--surface-selected);color:var(--text-secondary);padding:1px 6px;border-radius:var(--radius-pill);}
.ath-tabs--pill .ath-tab{border-radius:var(--radius-xs);padding:6px 12px;}
.ath-tabs--pill .ath-tab::after{display:none;}
.ath-tabs--pill .ath-tab[aria-selected="true"]{background:var(--surface-selected);color:var(--text-primary);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'tabs');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Tabs({ tabs = [], value, onChange, variant = 'underline', className = '', ...rest }) {
  inject();
  return (
    <div className={`ath-tabs ${variant === 'pill' ? 'ath-tabs--pill' : ''} ${className}`} role="tablist" {...rest}>
      {tabs.map((t) => {
        const id = typeof t === 'object' ? t.id : t;
        const label = typeof t === 'object' ? t.label : t;
        const icon = typeof t === 'object' ? t.icon : null;
        const count = typeof t === 'object' ? t.count : null;
        return (
          <button key={id} role="tab" aria-selected={value === id} className="ath-tab" onClick={() => onChange && onChange(id)}>
            {icon}
            {label}
            {count != null && <span className="ath-tab__count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
