'use client';
import React from 'react';
import { Avatar as AntAvatar } from 'antd';

const TONES = ['#2326B8', '#3538D4', '#7C7FF5', '#2ED47A', '#FF8A3D', '#FF6FC1', '#F9C80E'];
const SIZES = { sm: 24, md: 32, lg: 40 };

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

/* antd Avatar with deterministic brand-tone background from the name. */
export function Avatar({ name = '', src, size = 'md', square = false, style = {}, ...rest }) {
  const px = typeof size === 'number' ? size : SIZES[size] || 32;
  const bg = TONES[(name.charCodeAt(0) || 0) % TONES.length];
  const colors = src ? {} : { backgroundColor: bg, color: bg === '#F9C80E' ? '#1a1400' : '#fff' };
  return (
    <AntAvatar
      size={px}
      shape={square ? 'square' : 'circle'}
      src={src}
      alt={name}
      title={name}
      style={{ flex: 'none', fontWeight: 600, fontSize: Math.round(px * 0.4), ...colors, ...style }}
      {...rest}
    >
      {initials(name)}
    </AntAvatar>
  );
}
