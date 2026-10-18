'use client';
import React from 'react';
import { Tag as AntTag, theme } from 'antd';

/* Query/filter chip over antd Tag. Either `field op value` (rendered as a
   key:value pill) or children. `onRemove` makes it closable. */
export function Tag({ field, op = ':', value, filter = false, onRemove, children, style, ...rest }) {
  const { token } = theme.useToken();
  return (
    <AntTag
      color={filter ? 'processing' : undefined}
      closable={!!onRemove}
      onClose={(e) => { e.preventDefault(); if (onRemove) onRemove(e); }}
      style={{ marginInlineEnd: 0, fontFamily: field != null ? token.fontFamilyCode : undefined, ...style }}
      {...rest}
    >
      {field != null ? (
        <span>
          <span style={{ color: token.colorTextSecondary }}>{field}</span>
          <span style={{ color: token.colorTextTertiary, padding: '0 3px' }}>{op}</span>
          <span style={{ color: token.colorText, fontWeight: 500 }}>{value}</span>
        </span>
      ) : children}
    </AntTag>
  );
}
