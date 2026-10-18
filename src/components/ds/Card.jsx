'use client';
import React from 'react';
import { Card as AntCard, Space, theme } from 'antd';

/* Surface over antd Card. Props: title, actions (→ extra), header (custom
   header node, replaces title), hover (→ hoverable), accent (gold border),
   padded (false → body has no padding, e.g. for tables). */
export function Card({ title, actions, hover = false, accent = false, padded = true, header, children, style, styles, ...rest }) {
  const { token } = theme.useToken();
  const head = header || title;
  return (
    <AntCard
      title={head || undefined}
      extra={actions ? <Space size={8}>{actions}</Space> : undefined}
      hoverable={hover}
      style={accent ? { borderColor: token.colorWarningBorder, ...style } : style}
      styles={{ body: padded ? undefined : { padding: 0 }, ...styles }}
      {...rest}
    >
      {children}
    </AntCard>
  );
}
