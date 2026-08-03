'use client';
import React, { useState, useActionState, useTransition } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { saveMailSettings, sendTestEmail } from '@/app/actions/settings';
import { SectionHeader, FormStatus, ToggleRow } from './parts';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <AC.Card header={<SectionHeader icon="Mail" title="SMTP" subtitle="Outbound email server for the Athena platform." />}>
        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <AC.Input label="Host" name="host" defaultValue={mail.host} placeholder="smtp.example.com" mono leadingIcon={<Icon name="Server" size={16} />} />
            <AC.Input label="Port" name="port" type="number" min={1} max={65535} defaultValue={mail.port} mono />
          </div>

          <ToggleRow label="Use TLS (implicit)" hint="On for port 465; off for 587/STARTTLS." checked={secure}>
            <AC.Switch checked={secure} onChange={() => setSecure((v) => !v)} />
          </ToggleRow>
          <input type="hidden" name="secure" value={secure ? 'on' : ''} />

          <AC.Input label="Username" name="user" defaultValue={mail.user} placeholder="apikey / user@example.com" mono leadingIcon={<Icon name="User" size={16} />} />
          <AC.Input
            label="Password"
            name="password"
            type="password"
            autoComplete="off"
            placeholder={mail.passwordConfigured ? '•••••••••••• (configured — leave blank to keep)' : 'SMTP password'}
            mono
            leadingIcon={<Icon name="KeyRound" size={16} />}
            hint="Stored encrypted. Leave blank to keep the current value."
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <AC.Input label="From name" name="fromName" defaultValue={mail.fromName} placeholder="Athena SOC Lab" leadingIcon={<Icon name="Type" size={16} />} />
            <AC.Input label="From address" name="fromAddress" type="email" defaultValue={mail.fromAddress} placeholder="no-reply@zaio.io" mono leadingIcon={<Icon name="AtSign" size={16} />} />
          </div>

          <FormStatus state={state} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <AC.Button type="submit" variant="primary" loading={saving} leadingIcon={<Icon name="Check" size={14} />}>Save mail settings</AC.Button>
          </div>
        </form>
      </AC.Card>

      <AC.Card header={<SectionHeader icon="Send" title="Test delivery" subtitle="Send a test email using the saved settings." />}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <AC.Input label="Send test email to" type="email" placeholder="you@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} leadingIcon={<Icon name="Mail" size={16} />} />
          </div>
          <AC.Button variant="secondary" loading={testing} leadingIcon={<Icon name="Send" size={14} />} onClick={runTest}>Send test</AC.Button>
        </div>
        {testResult && <div style={{ marginTop: 12 }}><FormStatus state={testResult} /></div>}
      </AC.Card>
    </div>
  );
}

export default MailSection;
