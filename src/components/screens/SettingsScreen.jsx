'use client';
import React, { useActionState } from 'react';
import { Button, Card, Flex, Input, Tabs } from 'antd';
import {
  UserOutlined, SafetyCertificateOutlined, MailOutlined, DatabaseOutlined, ApiOutlined, LockOutlined,
  CheckOutlined, KeyOutlined, RobotOutlined,
} from '@ant-design/icons';
import { updateProfile, changePassword } from '@/app/actions/settings';
import { SectionHeader, FormStatus, FormLayout, Page } from './settings/parts';
import { Field } from './scenarios/primitives';
import { SecuritySection } from './settings/SecuritySection';
import { MailSection } from './settings/MailSection';
import { StorageSection } from './settings/StorageSection';
import { ApiAccessSection } from './settings/ApiAccessSection';
import { McpSection } from './settings/McpSection';

/* Settings surface with tabbed sections. Account (profile + password) is
   per-user; Security, Mail, Storage and API Access are platform-wide. MCP
   (architects only) holds the signed-in architect's own MCP keys. */
export function SettingsScreen({ user, security, mail, storage, apiKeys, mcp }) {
  const items = [
    { key: 'account', label: 'Account', icon: <UserOutlined />, children: <AccountSection user={user} /> },
    { key: 'security', label: 'Security', icon: <SafetyCertificateOutlined />, children: <SecuritySection security={security} /> },
    { key: 'mail', label: 'Mail', icon: <MailOutlined />, children: <MailSection mail={mail} /> },
    { key: 'storage', label: 'Storage', icon: <DatabaseOutlined />, children: <StorageSection storage={storage} /> },
    { key: 'api', label: 'API Access', icon: <ApiOutlined />, children: <ApiAccessSection apiKeys={apiKeys} /> },
    ...(mcp ? [{ key: 'mcp', label: 'MCP', icon: <RobotOutlined />, children: <McpSection keys={mcp.keys} url={mcp.url} /> }] : []),
  ];

  return (
    <Page title="Settings" description="Your account, plus platform-wide security, mail, storage and API access." maxWidth={880}>
      <Tabs defaultActiveKey="account" items={items} destroyOnHidden />
    </Page>
  );
}

function AccountSection({ user }) {
  const [profileState, profileAction, savingProfile] = useActionState(updateProfile, {});
  const [pwState, pwAction, changingPw] = useActionState(changePassword, {});

  return (
    <Flex vertical gap={16}>
      <Card title={<SectionHeader icon={<UserOutlined />} title="Profile" subtitle="Your instructor account details." />}>
        <form action={profileAction}>
          <FormLayout>
            <Field label="Full name" required>
              <Input name="name" defaultValue={user.name} required prefix={<UserOutlined />} />
            </Field>
            <Field label="Email" hint="Email is your login and can't be changed here.">
              <Input value={user.email} disabled prefix={<MailOutlined />} />
            </Field>
            <Flex vertical gap={12}>
              <FormStatus state={profileState} />
              <Flex justify="flex-end">
                <Button type="primary" htmlType="submit" loading={savingProfile} icon={<CheckOutlined />}>Save profile</Button>
              </Flex>
            </Flex>
          </FormLayout>
        </form>
      </Card>

      <Card title={<SectionHeader icon={<LockOutlined />} title="Password" subtitle="Change your password." />}>
        <form action={pwAction}>
          <FormLayout>
            <Field label="Current password" required>
              <Input.Password name="currentPassword" autoComplete="current-password" required prefix={<KeyOutlined />} />
            </Field>
            <Field label="New password" required hint="At least 10 characters.">
              <Input.Password name="newPassword" autoComplete="new-password" required prefix={<KeyOutlined />} />
            </Field>
            <Field label="Confirm new password" required>
              <Input.Password name="confirmPassword" autoComplete="new-password" required prefix={<KeyOutlined />} />
            </Field>
            <Flex vertical gap={12}>
              <FormStatus state={pwState} />
              <Flex justify="flex-end">
                <Button type="primary" htmlType="submit" loading={changingPw} icon={<SafetyCertificateOutlined />}>Change password</Button>
              </Flex>
            </Flex>
          </FormLayout>
        </form>
      </Card>
    </Flex>
  );
}

export default SettingsScreen;
