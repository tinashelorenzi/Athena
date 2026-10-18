'use client';
import React from 'react';
import { Tag, Badge } from 'antd';
import { SEVERITY } from '@/theme/antdTheme';

/* SOC severity tag. level: critical|high|medium|low|info; `solid` fills the
   tag, `pulse` animates the dot (live / active). */
export function SeverityBadge({ level = 'info', solid = false, pulse = false, children, style, ...rest }) {
  const sev = SEVERITY[level] || SEVERITY.info;
  return (
    <Tag
      color={sev.color}
      variant={solid ? 'solid' : 'filled'}
      style={{ marginInlineEnd: 0, ...style }}
      {...rest}
    >
      <Badge
        status={pulse ? 'processing' : undefined}
        color={solid ? '#fff' : sev.hex}
        style={{ marginInlineEnd: 6 }}
      />
      {children ?? sev.label ?? level}
    </Tag>
  );
}
