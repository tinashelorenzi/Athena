'use client';
import React, { useState, useActionState } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { saveSecuritySettings } from '@/app/actions/settings';
import { SectionHeader, FormStatus, ToggleRow } from './parts';

/* Platform security settings: Cloudflare Turnstile bot protection on the login
   form, plus session lifetime. Wired end-to-end — when enabled, the login page
   renders the widget and the login action verifies the token server-side. */
export function SecuritySection({ security }) {
  const [state, action, saving] = useActionState(saveSecuritySettings, {});
  const [enabled, setEnabled] = useState(security.turnstileEnabled);

  return (
    <AC.Card header={<SectionHeader icon="ShieldCheck" title="Security" subtitle="Bot protection and session policy for the platform." />}>
      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ToggleRow
          label="Cloudflare Turnstile"
          hint="Show a bot-protection challenge on the sign-in form."
          checked={enabled}
        >
          <AC.Switch checked={enabled} onChange={() => setEnabled((v) => !v)} />
        </ToggleRow>
        {/* Switch isn't a native input, so mirror its state into the form. */}
        <input type="hidden" name="turnstileEnabled" value={enabled ? 'on' : ''} />

        <AC.Input
          label="Site key"
          name="turnstileSiteKey"
          defaultValue={security.turnstileSiteKey}
          placeholder="0x4AAAAAAA..."
          mono
          leadingIcon={<Icon name="Globe" size={16} />}
        />
        <AC.Input
          label="Secret key"
          name="turnstileSecretKey"
          type="password"
          autoComplete="off"
          placeholder={security.turnstileSecretConfigured ? '•••••••••••• (configured — leave blank to keep)' : 'Enter secret key'}
          mono
          leadingIcon={<Icon name="KeyRound" size={16} />}
          hint="Stored encrypted. Leave blank to keep the current value."
        />

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

        <AC.Input
          label="Session lifetime (days)"
          name="sessionLifetimeDays"
          type="number"
          min={1}
          max={90}
          defaultValue={security.sessionLifetimeDays}
          leadingIcon={<Icon name="CalendarClock" size={16} />}
          hint="How long a login stays valid. Applies to new logins (1–90 days)."
        />

        <FormStatus state={state} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <AC.Button type="submit" variant="primary" loading={saving} leadingIcon={<Icon name="Check" size={14} />}>Save security settings</AC.Button>
        </div>
      </form>
    </AC.Card>
  );
}

export default SecuritySection;
