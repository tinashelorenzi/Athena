'use client';
import React from 'react';

const CSS = `
.ath-tt{position:relative;display:inline-flex;}
.ath-tt__bubble{
  position:absolute;z-index:var(--z-toast);pointer-events:none;
  background:var(--gray-900);color:var(--gray-0);
  border:1px solid var(--gray-900);border-radius:var(--radius-sm);
  font-size:var(--fs-caption);font-weight:var(--fw-medium);line-height:1.4;
  padding:6px 9px;white-space:nowrap;box-shadow:var(--shadow-md);
  opacity:0;transform:translateY(2px);transition:opacity var(--dur-fast),transform var(--dur-fast);
}
.ath-tt:hover .ath-tt__bubble,.ath-tt:focus-within .ath-tt__bubble{opacity:1;transform:translateY(0);}
.ath-tt__bubble--top{bottom:calc(100% + 7px);left:50%;transform:translate(-50%,2px);}
.ath-tt:hover .ath-tt__bubble--top{transform:translate(-50%,0);}
.ath-tt__bubble--bottom{top:calc(100% + 7px);left:50%;transform:translate(-50%,-2px);}
.ath-tt:hover .ath-tt__bubble--bottom{transform:translate(-50%,0);}
.ath-tt__kbd{margin-left:6px;font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'tooltip');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Tooltip({ content, kbd, placement = 'top', children, className = '', ...rest }) {
  inject();
  return (
    <span className={`ath-tt ${className}`} {...rest}>
      {children}
      <span className={`ath-tt__bubble ath-tt__bubble--${placement}`} role="tooltip">
        {content}
        {kbd && <span className="ath-tt__kbd">{kbd}</span>}
      </span>
    </span>
  );
}
