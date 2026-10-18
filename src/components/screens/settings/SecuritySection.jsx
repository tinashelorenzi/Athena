'use client';
import React, { useState, useActionState } from 'react';
import { Button, Card, Divider, Flex, Input, Switch } from 'antd';
import { SafetyCertificateOutlined, GlobalOutlined, KeyOutlined, CheckOutlined, FieldTimeOutlined } from '@ant-design/icons';
import { saveSecuritySettings } from '@/app/actions/settings';
import { Field } from '../scenarios/primitives';
import { SectionHeader, FormStatus, ToggleRow, FormLayout } from './parts';

/* Platform security settings: Cloudflare Turnstile bot protection on the login
   form, plus session lifetime. Wired end-to-end — when enabled, the login page
   renders the widget and the login action verifies the token server-side. */
export function SecuritySection({ security }) {
  const [state, action, saving] = useActionState(saveSecuritySettings, {});
  const [enabled, setEnabled] = useState(security.turnstileEnabled);

  return (
    <Card title={<SectionHeader icon={<SafetyCertificateOutlined />} title="Security" subtitle="Bot protection and session policy for the platform." />}>
      <form action={action}>
        <FormLayout>
          <ToggleRow label="Cloudflare Turnstile" hint="Show a bot-protection challenge on the sign-in form.">
            <Switch checked={enabled} onChange={setEnabled} />
          </ToggleRow>
          {/* Switch isn't a native input, so mirror its state into the form. */}
          <input type="hidden" name="turnstileEnabled" value={enabled ? 'on' : ''} />

          <Field label="Site key">
            <Input name="turnstileSiteKey" defaultValue={security.turnstileSiteKey} placeholder="0x4AAAAAAA..." prefix={<GlobalOutlined />} />
          </Field>
          <Field label="Secret key" hint="Stored encrypted. Leave blank to keep the current value.">
            <Input.Password
              name="turnstileSecretKey"
              autoComplete="off"
              placeholder={security.turnstileSecretConfigured ? '•••••••••••• (configured — leave blank to keep)' : 'Enter secret key'}
              prefix={<KeyOutlined />}
            />
          </Field>

          <Divider style={{ margin: '4px 0 20px' }} />

          <Field label="Session lifetime (days)" hint="How long a login stays valid. Applies to new logins (1–90 days).">
            <Input name="sessionLifetimeDays" type="number" min={1} max={90} defaultValue={security.sessionLifetimeDays} prefix={<FieldTimeOutlined />} style={{ maxWidth: 220 }} />
          </Field>

          <Flex vertical gap={12}>
            <FormStatus state={state} />
            <Flex justify="flex-end">
              <Button type="primary" htmlType="submit" loading={saving} icon={<CheckOutlined />}>Save security settings</Button>
            </Flex>
          </Flex>
        </FormLayout>
      </form>
    </Card>
  );
}

export default SecuritySection;
