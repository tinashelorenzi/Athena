'use client';
import React from 'react';

const CSS = `
.ath-nav{
  display:flex;flex-direction:column;width:var(--sidebar-w);height:100%;
  background:var(--surface-panel);border-right:1px solid var(--border-subtle);flex:none;
}
.ath-nav__brand{display:flex;align-items:center;gap:10px;height:var(--topbar-h);padding:0 16px;border-bottom:1px solid var(--border-subtle);flex:none;}
.ath-nav__brand img{height:26px;width:auto;display:block;}
.ath-nav__wordmark{font-weight:var(--fw-bold);font-size:15px;letter-spacing:-.01em;color:var(--text-primary);}
.ath-nav__wordmark small{display:block;font-weight:var(--fw-medium);font-size:10px;letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--text-tertiary);}
.ath-nav__scroll{flex:1;overflow-y:auto;padding:10px 10px;display:flex;flex-direction:column;gap:2px;}
.ath-nav__section{font-size:var(--fs-micro);font-weight:var(--fw-semibold);letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--text-tertiary);padding:14px 10px 6px;}
.ath-navitem{
  display:flex;align-items:center;gap:11px;width:100%;text-align:left;
  background:transparent;border:none;cursor:pointer;color:var(--text-secondary);
  font-family:var(--font-sans);font-size:var(--fs-body);font-weight:var(--fw-medium);
  padding:9px 10px;border-radius:var(--radius-sm);position:relative;
  transition:background var(--dur-fast) var(--ease-standard),color var(--dur-fast) var(--ease-standard);
}
.ath-navitem svg{width:18px;height:18px;flex:none;}
.ath-navitem:hover{background:var(--surface-hover);color:var(--text-primary);}
.ath-navitem__label{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ath-navitem__badge{font-family:var(--font-mono);font-size:var(--fs-micro);font-weight:var(--fw-semibold);padding:1px 7px;border-radius:var(--radius-pill);background:var(--surface-selected);color:var(--text-secondary);}
.ath-navitem[aria-current="true"]{background:var(--brand-subtle-bg);color:var(--text-primary);}
.ath-navitem[aria-current="true"] svg{color:var(--brand-strong);}
.ath-navitem[aria-current="true"]::before{content:'';position:absolute;left:-10px;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:var(--brand-strong);}
.ath-navitem[aria-current="true"] .ath-navitem__badge{background:var(--brand);color:#fff;}
.ath-navitem__badge--crit{background:var(--sev-critical);color:#fff;}
.ath-nav__footer{border-top:1px solid var(--border-subtle);padding:10px;flex:none;}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'sidebarnav');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function SidebarNav({ brand, items = [], active, onSelect, footer, className = '', ...rest }) {
  inject();
  return (
    <nav className={`ath-nav ${className}`} {...rest}>
      {brand && <div className="ath-nav__brand">{brand}</div>}
      <div className="ath-nav__scroll">
        {items.map((it, i) => {
          if (it.section) return <div key={`s-${i}`} className="ath-nav__section">{it.section}</div>;
          return (
            <button
              key={it.id}
              className="ath-navitem"
              aria-current={active === it.id}
              onClick={() => onSelect && onSelect(it.id)}
            >
              {it.icon}
              <span className="ath-navitem__label">{it.label}</span>
              {it.badge != null && (
                <span className={`ath-navitem__badge ${it.critical ? 'ath-navitem__badge--crit' : ''}`}>{it.badge}</span>
              )}
            </button>
          );
        })}
      </div>
      {footer && <div className="ath-nav__footer">{footer}</div>}
    </nav>
  );
}
