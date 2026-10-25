'use client';
import React from 'react';
import { theme } from 'antd';

/* A short, non-virtual list: rows separated by hairlines. Replaces antd's
   deprecated List for the handful of items a card shows; for long, scrollable
   lists use antd Listy. */
export function StackList({ items, renderItem, rowKey = (_, i) => i, padding = '8px 0' }) {
  const { token } = theme.useToken();
  return (
    <div role="list">
      {items.map((item, i) => (
        <div
          key={rowKey(item, i)}
          role="listitem"
          style={{ padding, borderTop: i ? `1px solid ${token.colorBorderSecondary}` : 'none' }}
        >
          {renderItem(item, i)}
        </div>
      ))}
    </div>
  );
}

export default StackList;
