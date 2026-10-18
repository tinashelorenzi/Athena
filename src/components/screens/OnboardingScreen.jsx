'use client';
import React, { useActionState, useState } from 'react';
import { Card, Form, Input, Button, Alert, Flex, Typography, theme } from 'antd';
import { UserOutlined, LockOutlined, KeyOutlined, ArrowRightOutlined } from '@ant-design/icons';

/* First-login setup for bulk-created students: confirm their name and, if they
   like, replace the emailed starter password. Shown at /welcome until done.
   Native <form action> wrapping antd inputs (by `name`) keeps the server-action
   flow unchanged. */
export function OnboardingScreen({ action, email, defaultName }) {
  const { token } = theme.useToken();
  const [state, formAction, pending] = useActionState(action, {});
  const [setPw, setSetPw] = useState(false);
  const iconStyle = { color: token.colorTextTertiary };

  return (
    <Flex
      align="center"
      justify="center"
      style={{ minHeight: '100vh', padding: 24, background: `radial-gradient(90% 60% at 50% -10%, rgba(53,56,212,0.12), transparent 70%), ${token.colorBgLayout}` }}
    >
      <Card style={{ width: '100%', maxWidth: 440, boxShadow: token.boxShadowSecondary }} styles={{ body: { padding: 30 } }}>
        <Flex align="center" gap={10} style={{ marginBottom: 18 }}>
          <img src="/logo_img_white_background.png" alt="" style={{ height: 30, borderRadius: 6 }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#2326B8', letterSpacing: '-0.01em' }}>Athena</span>
        </Flex>

        <Typography.Title level={3} style={{ margin: '0 0 6px' }}>Welcome — let’s finish setup</Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 22 }}>
          Signing in as <Typography.Text strong>{email}</Typography.Text>. Set your name and you’re into the lab.
        </Typography.Paragraph>

        <form action={formAction}>
          <Form layout="vertical" component={false} requiredMark={false}>
            <Form.Item label="Full name" htmlFor="onb-name">
              <Input id="onb-name" name="name" defaultValue={defaultName || ''} placeholder="e.g. Amara Okafor" required autoFocus size="large" prefix={<UserOutlined style={iconStyle} />} />
            </Form.Item>

            {setPw && (
              <>
                <Form.Item label="New password" htmlFor="onb-password">
                  <Input.Password id="onb-password" name="password" placeholder="At least 10 characters" autoComplete="new-password" size="large" prefix={<LockOutlined style={iconStyle} />} />
                </Form.Item>
                <Form.Item label="Confirm password" htmlFor="onb-confirm">
                  <Input.Password id="onb-confirm" name="confirmPassword" placeholder="Repeat it" autoComplete="new-password" size="large" prefix={<LockOutlined style={iconStyle} />} />
                </Form.Item>
              </>
            )}
          </Form>

          <Flex vertical gap={16}>
            {setPw ? (
              <Button type="link" htmlType="button" size="small" onClick={() => setSetPw(false)} style={{ alignSelf: 'flex-start', padding: 0, color: token.colorTextTertiary }}>
                Keep my current password
              </Button>
            ) : (
              <Button type="link" htmlType="button" size="small" icon={<KeyOutlined />} onClick={() => setSetPw(true)} style={{ alignSelf: 'flex-start', padding: 0, fontWeight: 600 }}>
                Set a new password (optional)
              </Button>
            )}

            {state?.error && <Alert type="error" showIcon role="alert" title={state.error} />}

            <Button type="primary" htmlType="submit" size="large" block loading={pending} icon={<ArrowRightOutlined />} iconPlacement="end">
              {pending ? 'Saving' : 'Enter the lab'}
            </Button>
          </Flex>
        </form>
      </Card>
    </Flex>
  );
}

export default OnboardingScreen;
