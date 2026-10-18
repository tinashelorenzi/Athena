'use client';
import React, { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Avatar, Dropdown, Typography, Button, Flex, theme } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, DownOutlined } from '@ant-design/icons';
import { logout } from '@/app/actions/auth';

const { Sider, Header, Content } = Layout;

/* Shared sidebar layout for the instructor + console areas, built on antd
   Layout/Menu. `items` are antd menu items whose `key` is the route; the
   selected item is the longest key that prefixes the current path. */
export function SideShell({ subtitle, items, titles = {}, user, roleLabel, userMenu = [], headerExtra, children }) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [collapsed, setCollapsed] = useState(false);
  const [, startTransition] = useTransition();
  const { token } = theme.useToken();

  const keys = flattenKeys(items);
  const selected = keys
    .filter((k) => pathname === k || pathname.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0];
  const name = user?.name || 'User';

  const menu = {
    items: [
      ...userMenu,
      ...(userMenu.length ? [{ type: 'divider' }] : []),
      { key: '__logout', icon: <LogoutOutlined />, label: 'Sign out', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === '__logout') startTransition(() => logout());
      else if (key.startsWith('/')) router.push(key);
    },
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        width={240}
        collapsedWidth={72}
        collapsible
        collapsed={collapsed}
        trigger={null}
        style={{ borderRight: `1px solid ${token.colorBorderSecondary}`, overflow: 'auto' }}
      >
        <Flex align="center" gap={10} style={{ height: 56, padding: collapsed ? '0 22px' : '0 20px' }}>
          <img src="/logo_img_white_background.png" alt="" style={{ height: 28, borderRadius: 6 }} />
          {!collapsed && (
            <div style={{ lineHeight: 1.15 }}>
              <Typography.Text strong style={{ fontSize: 16 }}>Athena</Typography.Text>
              <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{subtitle}</div>
            </div>
          )}
        </Flex>
        <Menu
          mode="inline"
          selectedKeys={selected ? [selected] : []}
          items={items}
          onClick={({ key }) => router.push(key)}
          style={{ borderInlineEnd: 0, padding: '4px 8px' }}
        />
      </Sider>
      <Layout>
        <Header style={{ borderBottom: `1px solid ${token.colorBorderSecondary}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            type="text"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((c) => !c)}
          />
          <Typography.Title level={5} style={{ margin: 0 }}>{titles[selected] || 'Athena'}</Typography.Title>
          <div style={{ flex: 1 }} />
          {headerExtra}
          <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
            <Button type="text" style={{ height: 44, padding: '0 8px' }}>
              <Flex align="center" gap={10}>
                <Avatar style={{ background: token.colorPrimary }}>{initials(name)}</Avatar>
                <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{roleLabel}</div>
                </div>
                <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
              </Flex>
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ overflow: 'auto', minHeight: 0 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}

export function initials(name = '') {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
}

function flattenKeys(items = []) {
  return items.flatMap((i) => (i?.children ? flattenKeys(i.children) : i?.key ? [i.key] : []));
}

export default SideShell;
