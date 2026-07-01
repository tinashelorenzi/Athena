'use client';
import React from 'react';

const CSS = `
.ath-spinner{display:inline-block;border-radius:50%;border-style:solid;border-color:var(--border-strong);border-right-color:var(--brand-strong);animation:ath-spinner-rot .7s linear infinite;}
@keyframes ath-spinner-rot{to{transform:rotate(360deg);}}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'spinner');
  s.textContent = CSS;
  document.head.appendChild(s);
}

const SIZES = { sm: 14, md: 20, lg: 32 };

export function Spinner({ size = 'md', className = '', style = {}, ...rest }) {
  inject();
  const px = typeof size === 'number' ? size : SIZES[size];
  const bw = Math.max(2, Math.round(px / 9));
  return <span className={`ath-spinner ${className}`} style={{ width: px, height: px, borderWidth: bw, ...style }} role="status" aria-label="Loading" {...rest} />;
}
