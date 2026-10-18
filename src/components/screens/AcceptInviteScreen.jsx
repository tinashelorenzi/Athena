'use client';
import React, { useActionState } from 'react';
import { Card, Form, Input, Button, Alert, Result, Flex, Typography, theme } from 'antd';
import { UserOutlined, LockOutlined, DisconnectOutlined } from '@ant-design/icons';

/* Invitation acceptance — set name + password to activate a STUDENT account.
   On success the action creates the account, opens a session, and redirects.
   Native <form action> wrapping antd inputs (by `name`) keeps the server-action
   flow unchanged. */
export function AcceptInviteScreen({ valid, email, cohortName, action }) {
  const { token } = theme.useToken();
  const [state, formAction, pending] = useActionState(action, {});
  const iconStyle = { color: token.colorTextTertiary };

  return (
    <Flex
      align="center"
      justify="center"
      style={{ minHeight: '100vh', padding: 24, background: `radial-gradient(120% 90% at 50% 0%, rgba(35,38,184,0.14), transparent 60%), ${token.colorBgLayout}` }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <Flex align="center" justify="center" gap={11} style={{ marginBottom: 24 }}>
          <img src="/logo_img_white_background.png" alt="" style={{ height: 40, borderRadius: 8 }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#2326B8', letterSpacing: '-0.01em', lineHeight: 1.1 }}>Athena</div>
            <Typography.Text type="secondary" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Zaio SOC Lab</Typography.Text>
          </div>
        </Flex>

        <Card styles={{ body: { padding: 28 } }}>
          {!valid ? (
            <Result
              status="warning"
              icon={<DisconnectOutlined style={{ color: token.colorTextTertiary }} />}
              title="Invitation not valid"
              subTitle="This invitation link is invalid, already used, or expired. Ask your instructor to re-send it."
              style={{ padding: 0 }}
            />
          ) : (
            <>
              <Typography.Title level={4} style={{ margin: '0 0 4px' }}>Set up your account</Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
                Activating <Typography.Text strong>{email}</Typography.Text>
                {cohortName ? <> · cohort <Typography.Text strong>{cohortName}</Typography.Text></> : null}
              </Typography.Paragraph>

              <form action={formAction}>
                <Form layout="vertical" component={false} requiredMark={false}>
                  <Form.Item label="Your name" htmlFor="invite-name">
                    <Input id="invite-name" name="name" required placeholder="Ada Lovelace" size="large" prefix={<UserOutlined style={iconStyle} />} />
                  </Form.Item>
                  <Form.Item label="Password" htmlFor="invite-password" extra="Password must be at least 10 characters.">
                    <Input.Password id="invite-password" name="password" autoComplete="new-password" required size="large" prefix={<LockOutlined style={iconStyle} />} />
                  </Form.Item>
                  <Form.Item label="Confirm password" htmlFor="invite-confirm">
                    <Input.Password id="invite-confirm" name="confirmPassword" autoComplete="new-password" required size="large" prefix={<LockOutlined style={iconStyle} />} />
                  </Form.Item>
                </Form>

                <Flex vertical gap={16}>
                  {state?.error && <Alert type="error" showIcon role="alert" title={state.error} />}
                  <Button type="primary" htmlType="submit" size="large" block loading={pending}>
                    {pending ? 'Setting up' : 'Activate account'}
                  </Button>
                </Flex>
              </form>
            </>
          )}
        </Card>
      </div>
    </Flex>
  );
}

export default AcceptInviteScreen;
