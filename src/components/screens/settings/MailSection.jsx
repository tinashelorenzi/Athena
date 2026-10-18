'use client';
import React, { useState, useActionState, useTransition } from 'react';
import { Button, Card, Col, Flex, Input, Row, Space, Switch } from 'antd';
import { MailOutlined, CloudServerOutlined, UserOutlined, KeyOutlined, FontSizeOutlined, SendOutlined, CheckOutlined } from '@ant-design/icons';
import { saveMailSettings, sendTestEmail } from '@/app/actions/settings';
import { Field } from '../scenarios/primitives';
import { SectionHeader, FormStatus, ToggleRow, FormLayout } from './parts';

/* SMTP credentials for outbound platform mail, plus a "send test" that actually
   attempts delivery through the stored settings (via nodemailer). */
export function MailSection({ mail }) {
  const [state, action, saving] = useActionState(saveMailSettings, {});
  const [secure, setSecure] = useState(mail.secure);

  const [testTo, setTestTo] = useState('');
  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState(null); // { ok } | { error }

  const runTest = () => {
    setTestResult(null);
    startTest(async () => {
      const res = await sendTestEmail(testTo);
      setTestResult(res);
    });
  };

  return (
    <Flex vertical gap={16}>
      <Card title={<SectionHeader icon={<MailOutlined />} title="SMTP" subtitle="Outbound email server for the Athena platform." />}>
        <form action={action}>
          <FormLayout>
            <Row gutter={16}>
              <Col xs={24} md={16}>
                <Field label="Host"><Input name="host" defaultValue={mail.host} placeholder="smtp.example.com" prefix={<CloudServerOutlined />} /></Field>
              </Col>
              <Col xs={24} md={8}>
                <Field label="Port"><Input name="port" type="number" min={1} max={65535} defaultValue={mail.port} /></Field>
              </Col>
            </Row>

            <ToggleRow label="Use TLS (implicit)" hint="On for port 465; off for 587/STARTTLS.">
              <Switch checked={secure} onChange={setSecure} />
            </ToggleRow>
            <input type="hidden" name="secure" value={secure ? 'on' : ''} />

            <Field label="Username">
              <Input name="user" defaultValue={mail.user} placeholder="apikey / user@example.com" prefix={<UserOutlined />} />
            </Field>
            <Field label="Password" hint="Stored encrypted. Leave blank to keep the current value.">
              <Input.Password
                name="password"
                autoComplete="off"
                placeholder={mail.passwordConfigured ? '•••••••••••• (configured — leave blank to keep)' : 'SMTP password'}
                prefix={<KeyOutlined />}
              />
            </Field>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Field label="From name"><Input name="fromName" defaultValue={mail.fromName} placeholder="Athena SOC Lab" prefix={<FontSizeOutlined />} /></Field>
              </Col>
              <Col xs={24} md={12}>
                <Field label="From address"><Input name="fromAddress" type="email" defaultValue={mail.fromAddress} placeholder="no-reply@zaio.io" prefix={<MailOutlined />} /></Field>
              </Col>
            </Row>

            <Flex vertical gap={12}>
              <FormStatus state={state} />
              <Flex justify="flex-end">
                <Button type="primary" htmlType="submit" loading={saving} icon={<CheckOutlined />}>Save mail settings</Button>
              </Flex>
            </Flex>
          </FormLayout>
        </form>
      </Card>

      <Card title={<SectionHeader icon={<SendOutlined />} title="Test delivery" subtitle="Send a test email using the saved settings." />}>
        <Flex vertical gap={12}>
          <Space.Compact style={{ width: '100%' }}>
            <Input type="email" placeholder="you@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} prefix={<MailOutlined />} onPressEnter={runTest} />
            <Button loading={testing} icon={<SendOutlined />} onClick={runTest}>Send test</Button>
          </Space.Compact>
          <FormStatus state={testResult} />
        </Flex>
      </Card>
    </Flex>
  );
}

export default MailSection;
