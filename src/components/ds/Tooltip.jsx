'use client';
import React from 'react';
import { Tooltip as AntTooltip, Typography } from 'antd';

/* antd Tooltip. content + optional keyboard hint (kbd). */
export function Tooltip({ content, kbd, placement = 'top', children, className, style, ...rest }) {
  return (
    <AntTooltip
      placement={placement}
      title={kbd ? <span>{content} <Typography.Text keyboard style={{ color: 'inherit' }}>{kbd}</Typography.Text></span> : content}
      {...rest}
    >
      <span className={className} style={{ display: 'inline-flex', ...style }}>{children}</span>
    </AntTooltip>
  );
}
