'use client';
import React, { useMemo, useState, useTransition } from 'react';
import {
  Alert, App, Button, Card, Dropdown, Empty, Flex, Form, Input, Modal, Space, Switch, Table, Tag, Tooltip, Typography,
} from 'antd';
import {
  UserAddOutlined, SearchOutlined, KeyOutlined, ReloadOutlined, UserOutlined, MailOutlined, EditOutlined, MoreOutlined,
  LogoutOutlined, StopOutlined, CheckCircleOutlined, DeleteOutlined, CrownOutlined,
} from '@ant-design/icons';
import { createStaff, deleteStaff, resetStaffPassword, setStaffDisabled, signOutStaff, updateStaff } from '@/app/actions/staff';
import { generatePassword } from '@/lib/password-gen';
import { FormLayout, Page } from './settings/parts';
import { CredentialDialog } from './StudentsManager';

const { Text } = Typography;
const day = (iso) => (iso ? iso.slice(0, 10) : '—');
const stamp = (iso) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : 'Never');

/* Staff page: architects manage instructor accounts. Data comes from the
   server page; every change goes through @/app/actions/staff. */
export function StaffManager({ staff, meId }) {
  const { message, modal } = App.useApp();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);    // row | 'new'
  const [resetting, setResetting] = useState(null); // row
  const [cred, setCred] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const act = async (row, fn, ok) => {
    setBusyId(row.id);
    const res = await fn();
    setBusyId(null);
    if (res?.error) message.error(res.error);
    else message.success(typeof ok === 'function' ? ok(res) : ok);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter((s) => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [staff, query]);

  const active = staff.filter((s) => !s.disabledAt);
  const architects = active.filter((s) => s.isArchitect).length;

  const menuFor = (row) => ({
    items: [
      { key: 'signout', icon: <LogoutOutlined />, label: 'Sign out everywhere', disabled: row.activeSessions === 0 },
      row.disabledAt
        ? { key: 'enable', icon: <CheckCircleOutlined />, label: 'Reactivate' }
        : { key: 'disable', icon: <StopOutlined />, label: 'Deactivate' },
      { type: 'divider' },
      { key: 'delete', icon: <DeleteOutlined />, label: 'Delete account', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'signout') act(row, () => signOutStaff(row.id), (r) => `Ended ${r.sessions} session${r.sessions === 1 ? '' : 's'} for ${row.name}.`);
      if (key === 'enable') act(row, () => setStaffDisabled(row.id, false), `${row.name} can sign in again.`);
      if (key === 'disable') {
        modal.confirm({
          title: `Deactivate ${row.name}?`,
          content: 'They are signed out and can’t sign in, and their MCP keys stop working. Their scenarios, grading and history stay. You can reactivate them later.',
          okText: 'Deactivate',
          okButtonProps: { danger: true },
          onOk: () => act(row, () => setStaffDisabled(row.id, true), `${row.name} is deactivated.`),
        });
      }
      if (key === 'delete') {
        modal.confirm({
          title: `Delete ${row.name}’s account?`,
          content: `${row.email} is removed for good, with their sessions, MCP keys and machines. Scenarios, cohorts and grades they made stay. To keep the account, deactivate it instead.`,
          okText: 'Delete account',
          okButtonProps: { danger: true },
          onOk: () => act(row, () => deleteStaff(row.id), `${row.name}’s account is deleted.`),
        });
      }
    },
  });

  const columns = [
    {
      title: 'Instructor', dataIndex: 'name', key: 'name', minWidth: 220,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v, row) => (
        <Flex vertical gap={2}>
          <Flex gap={6} align="center" wrap>
            <Text strong type={row.disabledAt ? 'secondary' : undefined}>{v}</Text>
            {row.id === meId && <Tag style={{ margin: 0 }}>You</Tag>}
            {row.isArchitect && <Tag color="purple" icon={<CrownOutlined />} style={{ margin: 0 }}>Architect</Tag>}
            {row.disabledAt && <Tooltip title={`Since ${day(row.disabledAt)}`}><Tag color="red" style={{ margin: 0 }}>Deactivated</Tag></Tooltip>}
          </Flex>
          <Text type="secondary" copyable={{ text: row.email }} style={{ fontSize: 13 }}>{row.email}</Text>
        </Flex>
      ),
    },
    {
      title: 'Last sign-in', dataIndex: 'lastSignInAt', key: 'last', width: 190,
      sorter: (a, b) => (a.lastSignInAt ?? '').localeCompare(b.lastSignInAt ?? ''),
      render: (v, row) => (
        <Flex vertical>
          <Text>{stamp(v)}</Text>
          {row.activeSessions > 0 && <Text type="secondary" style={{ fontSize: 12 }}>{row.activeSessions} active session{row.activeSessions === 1 ? '' : 's'}</Text>}
        </Flex>
      ),
    },
    {
      title: 'MCP keys', dataIndex: 'mcpKeys', key: 'mcp', width: 90, align: 'center', responsive: ['lg'],
      render: (v) => (v ? v : <Text type="secondary">—</Text>),
    },
    {
      title: '', key: 'actions', width: 210, align: 'right',
      render: (_v, row) => (
        <Space size={4}>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditing(row)}>Edit</Button>
          {row.id !== meId && (
            <>
              <Button size="small" type="text" icon={<KeyOutlined />} onClick={() => setResetting(row)}>Reset</Button>
              <Dropdown menu={menuFor(row)} trigger={['click']}>
                <Button size="small" type="text" loading={busyId === row.id} icon={<MoreOutlined />} aria-label={`More actions for ${row.name}`} />
              </Dropdown>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Page
      title="Staff"
      description={`${active.length} active instructor${active.length === 1 ? '' : 's'} · ${architects} architect${architects === 1 ? '' : 's'}${staff.length > active.length ? ` · ${staff.length - active.length} deactivated` : ''}`}
      extra={<>
        <Input allowClear prefix={<SearchOutlined />} placeholder="Search name or email…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 240 }} />
        <Button type="primary" icon={<UserAddOutlined />} onClick={() => setEditing('new')}>Add instructor</Button>
      </>}
    >
      <Alert
        type="info"
        showIcon
        title="Instructors run cohorts, grading and assignments. Architects can also author scenarios and labs, use MCP, and manage staff here."
      />
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="No matches. Try a different search." /> }}
        />
      </Card>

      {editing && (
        <EditDialog
          row={editing === 'new' ? null : editing}
          isMe={editing !== 'new' && editing.id === meId}
          onClose={() => setEditing(null)}
          onCreated={(created) => { setEditing(null); setCred({ title: 'Instructor account created', email: created.email, password: created.password }); }}
        />
      )}
      {resetting && (
        <ResetDialog
          row={resetting}
          onClose={() => setResetting(null)}
          onDone={(res) => { setResetting(null); setCred({ title: `New password for ${resetting.name}`, email: res.email, password: res.password }); }}
        />
      )}
      <CredentialDialog cred={cred} onClose={() => setCred(null)} />
    </Page>
  );
}

/* Add an instructor (row = null) or edit one. */
function EditDialog({ row, isMe, onClose, onCreated }) {
  const { message } = App.useApp();
  const [name, setName] = useState(row?.name ?? '');
  const [email, setEmail] = useState(row?.email ?? '');
  const [architect, setArchitect] = useState(row?.isArchitect ?? false);
  const [pwd, setPwd] = useState(() => (row ? '' : generatePassword()));
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();

  const submit = (e) => {
    e.preventDefault();
    start(async () => {
      if (!row) {
        const res = await createStaff({ name, email, password: pwd, isArchitect: architect });
        if (res?.error) { setError(res.error); return; }
        onCreated(res);
        return;
      }
      const res = await updateStaff(row.id, { name, email, isArchitect: architect });
      if (res?.error) { setError(res.error); return; }
      message.success(res.changed.length ? `${name} saved.` : 'Nothing changed.');
      onClose();
    });
  };

  return (
    <Modal
      open
      title={row ? `Edit ${row.name}` : 'Add instructor'}
      onCancel={onClose}
      destroyOnHidden
      okText={row ? 'Save' : 'Create instructor'}
      okButtonProps={{ htmlType: 'submit', form: 'staff-edit', icon: row ? undefined : <UserAddOutlined /> }}
      confirmLoading={pending}
    >
      <form id="staff-edit" onSubmit={submit}>
        <FormLayout>
          <Form.Item label="Full name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Thandi Nkosi" required prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item label="Email" required extra={row ? 'They sign in with this email.' : undefined}>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="instructor@zaio.io" required prefix={<MailOutlined />} />
          </Form.Item>
          {!row && (
            <Form.Item label="Password" extra="Shown once after creating. Or type your own (at least 10 characters).">
              <Space.Compact style={{ width: '100%' }}>
                <Input value={pwd} onChange={(e) => setPwd(e.target.value)} prefix={<KeyOutlined />} />
                <Button icon={<ReloadOutlined />} onClick={() => setPwd(generatePassword())}>Generate</Button>
              </Space.Compact>
            </Form.Item>
          )}
          <Form.Item
            label="Architect"
            extra={isMe ? 'You can’t remove your own architect permission.' : 'Architects author scenarios and labs, use MCP, and manage staff.'}
          >
            <Switch checked={architect} onChange={setArchitect} disabled={isMe} />
          </Form.Item>
        </FormLayout>
        {error && <Alert type="error" showIcon title={error} />}
      </form>
    </Modal>
  );
}

function ResetDialog({ row, onClose, onDone }) {
  const [pwd, setPwd] = useState(() => generatePassword());
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();

  const submit = (e) => {
    e.preventDefault();
    start(async () => {
      const res = await resetStaffPassword(row.id, pwd);
      if (res?.error) { setError(res.error); return; }
      onDone(res);
    });
  };

  return (
    <Modal
      open
      title={`Reset ${row.name}’s password`}
      onCancel={onClose}
      destroyOnHidden
      okText="Set password"
      okButtonProps={{ htmlType: 'submit', form: 'staff-reset', icon: <KeyOutlined /> }}
      confirmLoading={pending}
    >
      <form id="staff-reset" onSubmit={submit}>
        <Typography.Paragraph type="secondary">
          The old password stops working and {row.name} is signed out everywhere. The new one is shown once.
        </Typography.Paragraph>
        <FormLayout>
          <Form.Item label="New password">
            <Space.Compact style={{ width: '100%' }}>
              <Input value={pwd} onChange={(e) => setPwd(e.target.value)} prefix={<KeyOutlined />} />
              <Button icon={<ReloadOutlined />} onClick={() => setPwd(generatePassword())}>Generate</Button>
            </Space.Compact>
          </Form.Item>
        </FormLayout>
        {error && <Alert type="error" showIcon title={error} />}
      </form>
    </Modal>
  );
}

export default StaffManager;
