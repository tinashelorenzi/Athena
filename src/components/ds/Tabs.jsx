'use client';
import React from 'react';
import { Tabs as AntTabs, Segmented, Space, Tag } from 'antd';

function norm(t) {
  return typeof t === 'object'
    ? { id: t.id, label: t.label, icon: t.icon, count: t.count }
    : { id: t, label: t, icon: null, count: null };
}

function TabLabel({ t }) {
  return (
    <Space size={6}>
      {t.icon}
      {t.label}
      {t.count != null && <Tag style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '16px', paddingInline: 6 }}>{t.count}</Tag>}
    </Space>
  );
}

/* Tab bar. variant "underline" → antd Tabs (header only, callers render the
   panel), variant "pill" → antd Segmented. onChange(id). */
export function Tabs({ tabs = [], value, onChange, variant = 'underline', className = '', style, ...rest }) {
  const list = tabs.map(norm);
  if (variant === 'pill') {
    return (
      <Segmented
        value={value}
        onChange={(v) => onChange && onChange(v)}
        options={list.map((t) => ({ value: t.id, label: <TabLabel t={t} /> }))}
        className={className}
        style={style}
        {...rest}
      />
    );
  }
  return (
    <div className={className} style={style} {...rest}>
      <AntTabs
        activeKey={value}
        onChange={(k) => onChange && onChange(k)}
        items={list.map((t) => ({ key: t.id, label: <TabLabel t={t} /> }))}
        tabBarStyle={{ marginBottom: 0 }}
      />
    </div>
  );
}
