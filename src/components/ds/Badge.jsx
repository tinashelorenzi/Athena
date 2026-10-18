'use client';
import React from 'react';
import { Tag, Badge as AntBadge } from 'antd';

/* DS tone → antd Tag colour */
const TONES = {
  neutral: 'default',
  default: 'default',
  brand: 'processing',
  accent: 'gold',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  critical: 'error',
  info: 'processing',
};

/* Status / label pill over antd Tag. Props: tone, square, dot, icon. */
export function Badge({ tone = 'neutral', square = false, dot = false, icon = null, children, style, ...rest }) {
  const color = TONES[tone] || 'default';
  return (
    <Tag
      color={color}
      icon={icon || undefined}
      style={{ marginInlineEnd: 0, borderRadius: square ? undefined : 999, ...style }}
      {...rest}
    >
      {dot && <AntBadge color="currentColor" style={{ marginInlineEnd: 6 }} />}
      {children}
    </Tag>
  );
}
