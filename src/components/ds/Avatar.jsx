'use client';
import React from 'react';

const CSS = `
.ath-avatar{
  display:inline-flex;align-items:center;justify-content:center;flex:none;
  border-radius:var(--radius-pill);background:var(--brand);color:#fff;
  font-family:var(--font-sans);font-weight:var(--fw-semibold);
  overflow:hidden;user-select:none;line-height:1;
}
.ath-avatar img{width:100%;height:100%;object-fit:cover;}
.ath-avatar--sq{border-radius:var(--radius-sm);}
.ath-avatar--sm{width:24px;height:24px;font-size:10px;}
.ath-avatar--md{width:32px;height:32px;font-size:13px;}
.ath-avatar--lg{width:40px;height:40px;font-size:15px;}
`;

const TONES = ['#2326B8', '#3538D4', '#7C7FF5', '#2ED47A', '#FF8A3D', '#FF6FC1', '#F9C80E'];

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'avatar');
  s.textContent = CSS;
  document.head.appendChild(s);
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

export function Avatar({ name = '', src, size = 'md', square = false, className = '', style = {}, ...rest }) {
  inject();
  const cls = ['ath-avatar', `ath-avatar--${size}`, square ? 'ath-avatar--sq' : '', className].filter(Boolean).join(' ');
  const bg = TONES[(name.charCodeAt(0) || 0) % TONES.length];
  const bgStyle = src ? {} : { background: bg, color: bg === '#F9C80E' ? '#1a1400' : '#fff' };
  return (
    <span className={cls} style={{ ...bgStyle, ...style }} title={name} {...rest}>
      {src ? <img src={src} alt={name} /> : initials(name)}
    </span>
  );
}
