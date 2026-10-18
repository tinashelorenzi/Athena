'use client';
import React from 'react';
import { Menu, Badge, Flex } from 'antd';

/* Legacy sidebar API over antd Menu (the app shells now build their own
   Layout.Sider). items: [{ section } | { id, label, icon, badge, critical }]. */
export function SidebarNav({ brand, items = [], active, onSelect, footer, className = '', style, ...rest }) {
  const menuItems = [];
  let group = null;
  for (const it of items) {
    if (it.section) {
      group = { type: 'group', key: `s-${it.section}`, label: it.section, children: [] };
      menuItems.push(group);
      continue;
    }
    const entry = {
      key: it.id,
      icon: it.icon,
      label: (
        <Flex justify="space-between" align="center" gap={8}>
          <span>{it.label}</span>
          {it.badge != null && <Badge count={it.badge} color={it.critical ? undefined : 'default'} size="small" />}
        </Flex>
      ),
    };
    (group ? group.children : menuItems).push(entry);
  }
  return (
    <Flex vertical className={className} style={{ height: '100%', ...style }} {...rest}>
      {brand && <div style={{ padding: 16 }}>{brand}</div>}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Menu
          mode="inline"
          selectedKeys={active ? [active] : []}
          onClick={({ key }) => onSelect && onSelect(key)}
          items={menuItems}
          style={{ borderInlineEnd: 0 }}
        />
      </div>
      {footer && <div style={{ padding: 12 }}>{footer}</div>}
    </Flex>
  );
}
