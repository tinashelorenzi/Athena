'use client';
import React, { useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Avatar, Dropdown, Button, Flex, Typography, theme } from 'antd';
import { HomeOutlined, AimOutlined, CompassOutlined, LogoutOutlined, DownOutlined } from '@ant-design/icons';
import { logout } from '@/app/actions/auth';
import { startTour } from '@/components/Tour';
import { initials } from '@/components/shell/SideShell';

/* Student top bar: brand + primary nav (Dashboard / ATT&CK Explorer) + user
   menu. `left` replaces the brand+nav with custom content (e.g. the scenario
   workspace's back button + title). */
export function StudentTopBar({ user, left }) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const [, startTransition] = useTransition();
  const { token } = theme.useToken();
  const name = user?.name || 'Student';
  const selected = pathname.startsWith('/attack') ? '/attack' : '/learn';

  const menu = {
    items: [
      { key: 'tour', icon: <CompassOutlined />, label: 'Replay walkthrough' },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'tour') startTour();
      if (key === 'logout') startTransition(() => logout());
    },
  };

  return (
    <Layout.Header
      style={{
        flex: 'none', display: 'flex', alignItems: 'center', gap: 16,
        borderBottom: `1px solid ${token.colorBorderSecondary}`, paddingInline: 20,
      }}
    >
      {left ?? (
        <>
          <Link href="/learn" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo_img_white_background.png" alt="" style={{ height: 28, borderRadius: 6 }} />
            <Typography.Text strong style={{ fontSize: 16 }}>Athena</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>SOC Lab</Typography.Text>
          </Link>
          <Menu
            mode="horizontal"
            selectedKeys={[selected]}
            onClick={({ key }) => router.push(key)}
            items={[
              { key: '/learn', icon: <HomeOutlined />, label: 'Dashboard' },
              { key: '/attack', icon: <AimOutlined />, label: 'ATT&CK Explorer' },
            ]}
            style={{ flex: 1, minWidth: 0, borderBottom: 0, marginLeft: 12 }}
          />
        </>
      )}
      {left && <div style={{ flex: 1 }} />}
      <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
        <Button type="text" style={{ height: 44, padding: '0 8px' }}>
          <Flex align="center" gap={10}>
            <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
              {user?.cohort && <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{user.cohort}</div>}
            </div>
            <Avatar style={{ background: token.colorPrimary }}>{initials(name)}</Avatar>
            <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
          </Flex>
        </Button>
      </Dropdown>
    </Layout.Header>
  );
}

export default StudentTopBar;
