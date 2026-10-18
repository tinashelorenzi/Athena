'use client';
import React, { useMemo, useState, useTransition, useActionState } from 'react';
import {
  Alert, App, Button, Card, Descriptions, Empty, Flex, Form, Input, Modal, Popconfirm, Select, Space, Table, Typography,
} from 'antd';
import {
  UserAddOutlined, UsergroupAddOutlined, SearchOutlined, KeyOutlined, DeleteOutlined, ReloadOutlined, UserOutlined,
  MailOutlined, CopyOutlined, CheckOutlined, TeamOutlined,
} from '@ant-design/icons';
import { createStudent, bulkCreateStudents, resetStudentPassword, deleteStudent } from '@/app/actions/students';
import { generatePassword } from '@/lib/password-gen';
import { FormLayout, Page } from './settings/parts';

/* Student Management surface. Data (the `students` list) comes from the server
   page; mutations go through Server Actions which revalidate the list. */
export function StudentsManager({ students, cohorts = [] }) {
  const { message } = App.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [creating, startCreate] = useTransition();
  const [cred, setCred] = useState(null);      // { title, email, password }
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [cohortSel, setCohortSel] = useState('');
  const [pwd, setPwd] = useState('');

  const openCreate = () => { setCreateError(null); setCohortSel(''); setPwd(generatePassword()); setCreateOpen(true); };

  // Call the Server Action directly and handle the result in the submit handler
  // (no effect needed). The action revalidates the list server-side.
  const onCreateSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startCreate(async () => {
      const res = await createStudent({}, formData);
      if (res?.error) { setCreateError(res.error); return; }
      form.reset();
      setCreateError(null);
      setCreateOpen(false);
      setCred({ title: 'Student account created', ...res.created });
    });
  };

  const onReset = async (student) => {
    setBusyId(student.id);
    const res = await resetStudentPassword(student.id);
    setBusyId(null);
    if (res?.error) message.error(res.error);
    else setCred({ title: `New password for ${student.name}`, email: student.email, password: res.password });
  };

  const onDelete = async (student) => {
    setBusyId(student.id);
    const res = await deleteStudent(student.id);
    setBusyId(null);
    if (res?.error) message.error(res.error);
    else message.success(`${student.name} deleted.`);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [students, query]);

  const cohortFilters = useMemo(
    () => [...new Set(students.map((s) => s.cohort))].sort().map((c) => ({ text: c, value: c })),
    [students],
  );

  const columns = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v) => <Typography.Text strong>{v}</Typography.Text>,
    },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (v) => <Typography.Text copyable={{ text: v }}>{v}</Typography.Text> },
    {
      title: 'Cohort', dataIndex: 'cohort', key: 'cohort', width: 180,
      filters: cohortFilters, onFilter: (value, row) => row.cohort === value,
    },
    {
      title: 'Added', dataIndex: 'createdAt', key: 'createdAt', width: 120,
      sorter: (a, b) => a.createdAt.localeCompare(b.createdAt), defaultSortOrder: 'descend',
      render: (v) => new Date(v).toISOString().slice(0, 10),
    },
    {
      title: '', key: 'actions', width: 200, align: 'right',
      render: (_v, row) => (
        <Space size={4}>
          <Popconfirm
            title="Reset password?"
            description={`Generates a new password for ${row.name}; the old one stops working.`}
            okText="Reset"
            onConfirm={() => onReset(row)}
          >
            <Button size="small" type="text" loading={busyId === row.id} icon={<KeyOutlined />}>Reset</Button>
          </Popconfirm>
          <Popconfirm
            title="Delete student?"
            description={`${row.name} (${row.email}) will lose access immediately. This cannot be undone.`}
            okText="Delete student"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(row)}
          >
            <Button size="small" type="text" danger disabled={busyId === row.id} icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Page
      title="Students"
      description={`${students.length} ${students.length === 1 ? 'account' : 'accounts'} · provisioned by instructors`}
      extra={<>
        <Input allowClear prefix={<SearchOutlined />} placeholder="Search name or email…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 240 }} />
        <Button icon={<UsergroupAddOutlined />} onClick={() => setBulkOpen(true)}>Bulk add</Button>
        <Button type="primary" icon={<UserAddOutlined />} onClick={openCreate}>Add student</Button>
      </>}
    >
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 20, hideOnSinglePage: true, showTotal: (t) => `${t} students` }}
          locale={{
            emptyText: (
              <Empty description={students.length === 0 ? 'No students yet — add your first student to get them into the lab.' : 'No matches. Try a different search.'}>
                {students.length === 0 && <Button type="primary" onClick={openCreate}>Add student</Button>}
              </Empty>
            ),
          }}
        />
      </Card>

      {/* Create dialog */}
      <Modal
        open={createOpen}
        title="Add student"
        onCancel={() => setCreateOpen(false)}
        destroyOnHidden
        okText="Create student"
        okButtonProps={{ htmlType: 'submit', form: 'student-create', icon: <UserAddOutlined /> }}
        confirmLoading={creating}
      >
        <Typography.Paragraph type="secondary">Generate a password or type your own — it&apos;s shown once after creating.</Typography.Paragraph>
        <form id="student-create" onSubmit={onCreateSubmit}>
          <FormLayout>
            <Form.Item label="Full name" required>
              <Input name="name" placeholder="e.g. Amara Okafor" required prefix={<UserOutlined />} />
            </Form.Item>
            <Form.Item label="Email" required>
              <Input name="email" type="email" placeholder="student@zaio.io" required prefix={<MailOutlined />} />
            </Form.Item>
            <Form.Item label="Password" extra="Shown once after creating — copy it then. Or type your own.">
              <Space.Compact style={{ width: '100%' }}>
                <Input name="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="At least 10 characters" prefix={<KeyOutlined />} />
                <Button icon={<ReloadOutlined />} onClick={() => setPwd(generatePassword())}>Generate</Button>
              </Space.Compact>
            </Form.Item>
            <CohortPicker cohorts={cohorts} value={cohortSel} onChange={setCohortSel} />
          </FormLayout>
          {createError && <Alert type="error" showIcon title={createError} />}
        </form>
      </Modal>

      {/* Generated-credentials dialog (create + reset). */}
      <CredentialDialog cred={cred} onClose={() => setCred(null)} />

      {bulkOpen && <BulkAddDialog cohorts={cohorts} onClose={() => setBulkOpen(false)} />}
    </Page>
  );
}

/* Cohort select + "new cohort" name. Posts `cohortId` (or `newCohortName`). */
function CohortPicker({ cohorts, value, onChange }) {
  return (
    <>
      <Form.Item label="Cohort (optional)">
        <Select
          value={value}
          onChange={onChange}
          showSearch={{ optionFilterProp: 'label' }}
          options={[{ value: '', label: 'No cohort' }, ...cohorts.map((c) => ({ value: c.id, label: c.name })), { value: '__new__', label: '＋ New cohort…' }]}
        />
      </Form.Item>
      {value === '__new__'
        ? (
          <Form.Item label="New cohort name" required>
            <Input name="newCohortName" placeholder="New cohort name" required prefix={<TeamOutlined />} />
          </Form.Item>
        )
        : <input type="hidden" name="cohortId" value={value} />}
    </>
  );
}

function CredentialDialog({ cred, onClose }) {
  return (
    <Modal
      open={!!cred}
      title={<Flex align="center" gap={8}><KeyOutlined />{cred?.title}</Flex>}
      onCancel={onClose}
      destroyOnHidden
      footer={<Button type="primary" onClick={onClose}>Done</Button>}
    >
      {cred && (
        <Flex vertical gap={12}>
          <Alert type="warning" showIcon title="Copy this password now — it is shown only once and cannot be recovered, only reset." />
          <Descriptions bordered column={1} size="small" items={[
            { key: 'email', label: 'Email', children: <Typography.Text code copyable>{cred.email}</Typography.Text> },
            { key: 'password', label: 'Password', children: <Typography.Text code copyable={{ tooltips: ['Copy password', 'Copied'] }}>{cred.password}</Typography.Text> },
          ]} />
        </Flex>
      )}
    </Modal>
  );
}

function BulkAddDialog({ cohorts, onClose }) {
  const { message } = App.useApp();
  const [state, action, pending] = useActionState(bulkCreateStudents, {});
  const [cohortSel, setCohortSel] = useState('');
  const [copied, setCopied] = useState(false);
  const done = state?.ok != null;

  const copyList = async () => {
    const text = (state.created || []).map((c) => `${c.email}\t${c.password}`).join('\n');
    try { await navigator.clipboard.writeText(text); setCopied(true); message.success('Copied to clipboard'); } catch { /* clipboard blocked */ }
  };

  return (
    <Modal
      open
      width={600}
      title="Bulk add students"
      onCancel={onClose}
      destroyOnHidden
      footer={done ? (
        <Space>
          {state.created?.length > 0 && <Button icon={copied ? <CheckOutlined /> : <CopyOutlined />} onClick={copyList}>{copied ? 'Copied' : 'Copy list'}</Button>}
          <Button type="primary" onClick={onClose}>Done</Button>
        </Space>
      ) : (
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" form="bulk-add" loading={pending} icon={<UsergroupAddOutlined />}>Create accounts</Button>
        </Space>
      )}
    >
      {done ? (
        <Flex vertical gap={12}>
          <Alert type="success" showIcon title={state.ok} />
          <Typography.Text type="secondary">
            Each password is the student’s email with a capital first letter — e.g. <Typography.Text code>ada@zaio.io</Typography.Text> → <Typography.Text code>Ada@zaio.io</Typography.Text>. They’ll set their name (and can change the password) on first login.
          </Typography.Text>
          {state.created?.length > 0 && (
            <Table
              size="small"
              rowKey="email"
              bordered
              pagination={false}
              scroll={{ y: 220 }}
              dataSource={state.created}
              columns={[
                { title: 'Email', dataIndex: 'email', key: 'email' },
                { title: 'Password', dataIndex: 'password', key: 'password', render: (v) => <Typography.Text code>{v}</Typography.Text> },
              ]}
            />
          )}
          {state.skipped?.length > 0 && (
            <Alert type="info" showIcon title={`Skipped (${state.skipped.length})`} description={state.skipped.join(', ')} />
          )}
        </Flex>
      ) : (
        <form id="bulk-add" action={action}>
          <Typography.Paragraph type="secondary">
            Paste emails (one per line). Each gets an account whose password is its email with a capital first letter; they set their name on first login.
          </Typography.Paragraph>
          <FormLayout>
            <Form.Item label="Emails (one per line)" required>
              <Input.TextArea name="emails" rows={8} required spellCheck={false} placeholder={'ada@zaio.io\nalan@zaio.io\ngrace@zaio.io'} />
            </Form.Item>
            <CohortPicker cohorts={cohorts} value={cohortSel} onChange={setCohortSel} />
          </FormLayout>
          {state?.error && <Alert type="error" showIcon title={state.error} />}
        </form>
      )}
    </Modal>
  );
}

export default StudentsManager;
