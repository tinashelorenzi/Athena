'use client';
import React from 'react';
import Link from 'next/link';
import { Card, Result, Button, Flex, Typography, theme } from 'antd';
import { LockOutlined, LoginOutlined, HomeOutlined, SwapOutlined } from '@ant-design/icons';
import { logout } from '@/app/actions/auth';

/* Branded full-screen status page for the auth/navigation interrupts:
   401 (unauthorized — blurred backdrop + sign-in), 403 (forbidden — "not you?"),
   404 (not found). Rendered by the app-root unauthorized/forbidden/not-found
   special files. Built on antd Result. */
const VARIANTS = {
  401: { code: '401', title: 'Sign in to continue', message: 'This area is protected. Sign in with your Athena account to view it.', blur: true },
  403: { code: '403', title: "You don't have access", message: "You're signed in, but this isn't available to your account. If it belongs to a different account, sign in with that one.", blur: false },
  404: { code: '404', title: 'Page not found', message: "The page you're looking for doesn't exist, has moved, or the link is invalid.", blur: false },
};

function BlurBackdrop() {
  const { token } = theme.useToken();
  // A faux, heavily-blurred dashboard so 401 reads as "content behind a login".
  const block = { borderRadius: 12, background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` };
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', filter: 'blur(9px)', opacity: 0.7, pointerEvents: 'none', transform: 'scale(1.04)' }}>
      <Flex vertical gap={16} style={{ maxWidth: 1000, margin: '0 auto', padding: 32 }}>
        <div style={{ height: 26, width: 220, borderRadius: 8, background: token.colorFillSecondary }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ ...block, height: 84 }} />)}
        </div>
        <div style={{ ...block, height: 150 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ ...block, height: 168 }} />)}
        </div>
      </Flex>
    </div>
  );
}

export function StatusScreen({ variant = 404 }) {
  const { token } = theme.useToken();
  const v = VARIANTS[variant] || VARIANTS[404];

  let extra = null;
  if (variant === 401) {
    extra = (
      <Flex vertical gap={12} style={{ width: '100%' }}>
        <Link href="/login">
          <Button type="primary" size="large" block icon={<LoginOutlined />}>Sign in</Button>
        </Link>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Accounts are provisioned by your instructor.</Typography.Text>
      </Flex>
    );
  } else if (variant === 403) {
    extra = (
      <Flex vertical gap={10} style={{ width: '100%' }}>
        <Link href="/">
          <Button type="primary" block icon={<HomeOutlined />}>Go to your dashboard</Button>
        </Link>
        <form action={logout}>
          <Button type="text" htmlType="submit" block icon={<SwapOutlined />}>Not you? Sign in with a different account</Button>
        </form>
      </Flex>
    );
  } else {
    extra = (
      <Link href="/">
        <Button type="primary" block icon={<HomeOutlined />}>Back to Athena</Button>
      </Link>
    );
  }

  return (
    <Flex
      align="center"
      justify="center"
      style={{ position: 'relative', minHeight: '100vh', padding: 24, overflow: 'hidden', background: `radial-gradient(90% 60% at 50% -10%, rgba(53,56,212,0.12), transparent 70%), ${token.colorBgLayout}` }}
    >
      {v.blur && <BlurBackdrop />}

      <Card style={{ position: 'relative', width: '100%', maxWidth: 460, boxShadow: token.boxShadowSecondary }} styles={{ body: { padding: '28px 28px 8px' } }}>
        <Flex align="center" justify="center" gap={10}>
          <img src="/logo_img_white_background.png" alt="" style={{ height: 30, borderRadius: 6 }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#2326B8', letterSpacing: '-0.01em' }}>Athena</span>
        </Flex>
        <Result
          status={variant === 401 ? 'info' : variant === 403 ? '403' : '404'}
          icon={variant === 401 ? <LockOutlined style={{ color: token.colorPrimary }} /> : undefined}
          title={
            <>
              <div style={{ fontFamily: token.fontFamilyCode, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.14em', color: token.colorTextTertiary, marginBottom: 4 }}>ERROR {v.code}</div>
              {v.title}
            </>
          }
          subTitle={v.message}
          extra={extra}
          style={{ padding: '16px 0' }}
        />
      </Card>
    </Flex>
  );
}

export default StatusScreen;
