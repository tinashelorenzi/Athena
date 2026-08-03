'use client';
import React, { useState, useActionState } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { updateProfile, changePassword } from '@/app/actions/settings';
import { SectionHeader, FormStatus } from './settings/parts';
import { SecuritySection } from './settings/SecuritySection';
import { MailSection } from './settings/MailSection';
import { StorageSection } from './settings/StorageSection';
import { ApiAccessSection } from './settings/ApiAccessSection';

/* Settings surface with tabbed sections. Account (profile + password) is
   per-user; Security, Mail, Storage and API Access are platform-wide. */
const TABS = [
  { id: 'account', label: 'Account', icon: <Icon name="User" size={15} /> },
  { id: 'security', label: 'Security', icon: <Icon name="ShieldCheck" size={15} /> },
  { id: 'mail', label: 'Mail', icon: <Icon name="Mail" size={15} /> },
  { id: 'storage', label: 'Storage', icon: <Icon name="Database" size={15} /> },
  { id: 'api', label: 'API Access', icon: <Icon name="KeySquare" size={15} /> },
];

export function SettingsScreen({ user, security, mail, storage, apiKeys }) {
  const [tab, setTab] = useState('account');

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <AC.Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'account' && <AccountSection user={user} />}
      {tab === 'security' && <SecuritySection security={security} />}
      {tab === 'mail' && <MailSection mail={mail} />}
      {tab === 'storage' && <StorageSection storage={storage} />}
      {tab === 'api' && <ApiAccessSection apiKeys={apiKeys} />}
    </div>
  );
}

function AccountSection({ user }) {
  const [profileState, profileAction, savingProfile] = useActionState(updateProfile, {});
  const [pwState, pwAction, changingPw] = useActionState(changePassword, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <AC.Card header={<SectionHeader icon="User" title="Profile" subtitle="Your instructor account details." />}>
        <form action={profileAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AC.Input label="Full name" name="name" defaultValue={user.name} required leadingIcon={<Icon name="User" size={16} />} />
          <AC.Input label="Email" value={user.email} disabled mono leadingIcon={<Icon name="Mail" size={16} />} hint="Email is your login and can't be changed here." />
          <FormStatus state={profileState} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <AC.Button type="submit" variant="primary" loading={savingProfile} leadingIcon={<Icon name="Check" size={14} />}>Save profile</AC.Button>
          </div>
        </form>
      </AC.Card>

      <AC.Card header={<SectionHeader icon="Lock" title="Password" subtitle="Change your password." />}>
        <form action={pwAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AC.Input label="Current password" name="currentPassword" type="password" autoComplete="current-password" required leadingIcon={<Icon name="KeyRound" size={16} />} />
          <AC.Input label="New password" name="newPassword" type="password" autoComplete="new-password" required hint="At least 10 characters." leadingIcon={<Icon name="KeyRound" size={16} />} />
          <AC.Input label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required leadingIcon={<Icon name="KeyRound" size={16} />} />
          <FormStatus state={pwState} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <AC.Button type="submit" variant="primary" loading={changingPw} leadingIcon={<Icon name="ShieldCheck" size={14} />}>Change password</AC.Button>
          </div>
        </form>
      </AC.Card>
    </div>
  );
}

export default SettingsScreen;
