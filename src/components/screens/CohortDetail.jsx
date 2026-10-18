'use client';
import React, { useState, useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, App, Button, Card, Col, Descriptions, Empty, Flex, Form, Input, Modal, Popconfirm, Row, Space, Table, Tabs,
  Tag, Typography,
} from 'antd';
import {
  TeamOutlined, UserAddOutlined, AppstoreOutlined, EditOutlined, TrophyOutlined, DeleteOutlined, UserDeleteOutlined,
  UserOutlined, MailOutlined, KeyOutlined, ReloadOutlined, SendOutlined, ClockCircleOutlined, CloseOutlined,
  PlusOutlined, DisconnectOutlined, LinkOutlined, CrownFilled, CopyOutlined, CheckOutlined,
} from '@ant-design/icons';
import { deleteCohort, bindScenarios, unbindScenario, removeFromCohort } from '@/app/actions/cohorts';
import { sendInvitations, revokeInvitation } from '@/app/actions/invitations';
import { createStudent } from '@/app/actions/students';
import { generatePassword } from '@/lib/password-gen';
import { GradeReviewDialog } from './grading/GradeReviewDialog';
import { Textarea } from './scenarios/primitives';
import { FileField, FormLayout, FormStatus, GradeState, Page, SectionHeader, TypeTag, TYPE_META } from './settings/parts';

export function CohortDetail({ cohort, leaderboard, students, bound, invitations, allScenarios, submissions }) {
  const { message } = App.useApp();
  const onError = (e) => message.error(e);

  const items = [
    { key: 'members', label: `Members (${students.length})`, icon: <TeamOutlined />, children: <MembersTab cohort={cohort} students={students} onError={onError} /> },
    { key: 'invite', label: 'Add students', icon: <UserAddOutlined />, children: <InviteTab cohort={cohort} invitations={invitations} onError={onError} /> },
    { key: 'scenarios', label: `Scenarios (${bound.length})`, icon: <AppstoreOutlined />, children: <ScenariosTab cohort={cohort} bound={bound} allScenarios={allScenarios} onError={onError} /> },
    { key: 'grading', label: 'Grading', icon: <EditOutlined />, children: <GradingTab submissions={submissions} onError={onError} /> },
    { key: 'standings', label: 'Standings', icon: <TrophyOutlined />, children: <StandingsTab leaderboard={leaderboard} /> },
  ];

  return (
    <Page
      back="/admin/cohorts"
      title={cohort.name}
      description={`${students.length} students · ${bound.length} scenarios · ${invitations.length} pending invites`}
      maxWidth={1080}
      extra={
        <Popconfirm
          title="Delete cohort?"
          description={<div style={{ maxWidth: 320 }}>{`"${cohort.name}" will be deleted. Students are detached (their accounts remain); scenario bindings and pending invitations are removed.`}</div>}
          okText="Delete cohort"
          okButtonProps={{ danger: true }}
          onConfirm={() => deleteCohort(cohort.id)}
        >
          <Button danger icon={<DeleteOutlined />}>Delete</Button>
        </Popconfirm>
      }
    >
      <Tabs defaultActiveKey="members" items={items} destroyOnHidden />
    </Page>
  );
}

function MembersTab({ cohort, students, onError }) {
  const [busyId, setBusyId] = useState(null);
  const remove = async (s) => {
    setBusyId(s.id);
    const res = await removeFromCohort(s.id, cohort.id);
    setBusyId(null);
    if (res?.error) onError(res.error);
  };
  return (
    <Card styles={{ body: { padding: 0 } }}>
      <Table
        rowKey="id"
        dataSource={students}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="No students yet — add or invite them on the Add students tab, or set a student's cohort on the Students page." /> }}
        columns={[
          { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name), render: (v) => <Typography.Text strong>{v}</Typography.Text> },
          { title: 'Email', dataIndex: 'email', key: 'email', render: (v) => <Typography.Text copyable={{ text: v }}>{v}</Typography.Text> },
          {
            title: '', key: 'actions', align: 'right', width: 130,
            render: (_v, row) => (
              <Popconfirm title={`Remove ${row.name} from this cohort?`} description="Their account remains." okText="Remove" onConfirm={() => remove(row)}>
                <Button size="small" type="text" loading={busyId === row.id} icon={<UserDeleteOutlined />}>Remove</Button>
              </Popconfirm>
            ),
          },
        ]}
      />
    </Card>
  );
}

/* Create a student account directly in this cohort (no email needed). The
   instructor sets/generates the password and hands it over — shown once. */
function ManualAddCard({ cohort, onError }) {
  const [pwd, setPwd] = useState('');
  const [creating, startCreate] = useTransition();
  const [cred, setCred] = useState(null);
  const [linked, setLinked] = useState(null);

  // Seed a strong password after mount (client-only, so it can't cause an SSR
  // hydration mismatch on the input's value).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { setPwd(generatePassword()); }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set('cohortId', cohort.id);
    startCreate(async () => {
      setLinked(null);
      const res = await createStudent({}, formData);
      if (res?.error) { onError(res.error); return; }
      if (res?.linked) {
        setLinked(res.linked);
        form.reset();
        setPwd(generatePassword());
        return;
      }
      setCred({ email: res.created.email, password: res.created.password, name: res.created.name });
      form.reset();
      setPwd(generatePassword());
    });
  };

  return (
    <Card title={<SectionHeader icon={<UserAddOutlined />} title="Add a student directly" subtitle={`Create an account in ${cohort.name}, or link an existing Zaio LMS student by using the same email they use on Zaio.`} />}>
      <form onSubmit={onSubmit}>
        <FormLayout>
          {linked && (
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
              title={<><strong>{linked.name}</strong> ({linked.email}) is now in this cohort. They can sign in with <strong>Continue with Zaio LMS</strong>.</>}
            />
          )}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Full name" required><Input name="name" placeholder="e.g. Amara Okafor" required prefix={<UserOutlined />} /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Email" required><Input name="email" type="email" placeholder="student@zaio.io" required prefix={<MailOutlined />} /></Form.Item>
            </Col>
          </Row>
          <Form.Item label="Password" extra="For new accounts only — Zaio LMS students can ignore this and sign in with SSO.">
            <Space.Compact style={{ width: '100%' }}>
              <Input name="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="At least 10 characters" prefix={<KeyOutlined />} />
              <Button icon={<ReloadOutlined />} onClick={() => setPwd(generatePassword())}>Generate</Button>
            </Space.Compact>
          </Form.Item>
          <Flex justify="flex-end">
            <Button type="primary" htmlType="submit" loading={creating} icon={<UserAddOutlined />}>
              {creating ? 'Saving…' : 'Add to cohort'}
            </Button>
          </Flex>
        </FormLayout>
      </form>
      <CohortCredentialDialog cred={cred} onClose={() => setCred(null)} />
    </Card>
  );
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* clipboard blocked */ }
  };
  return <Button icon={copied ? <CheckOutlined /> : <CopyOutlined />} onClick={copy}>{copied ? 'Copied' : label}</Button>;
}

function CohortCredentialDialog({ cred, onClose }) {
  return (
    <Modal
      open={!!cred}
      title={<Flex align="center" gap={8}><KeyOutlined />{cred ? `Account created — ${cred.name}` : ''}</Flex>}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Space>
          {cred && <CopyButton text={`${cred.email}\n${cred.password}`} label="Copy both" />}
          <Button type="primary" onClick={onClose}>Done</Button>
        </Space>
      }
    >
      {cred && (
        <Flex vertical gap={12}>
          <Alert type="warning" showIcon title="Copy these now — the password is shown only once and can only be reset, not recovered." />
          <Descriptions bordered column={1} size="small" items={[
            { key: 'email', label: 'Email', children: <Typography.Text code copyable>{cred.email}</Typography.Text> },
            { key: 'password', label: 'Password', children: <Typography.Text code copyable>{cred.password}</Typography.Text> },
          ]} />
        </Flex>
      )}
    </Modal>
  );
}

function InviteTab({ cohort, invitations, onError }) {
  const [state, action, sending] = useActionState(sendInvitations, {});
  const [busyId, setBusyId] = useState(null);

  const revoke = async (inv) => {
    setBusyId(inv.id);
    const res = await revokeInvitation(inv.id);
    setBusyId(null);
    if (res?.error) onError(res.error);
  };

  return (
    <Flex vertical gap={16}>
      <ManualAddCard cohort={cohort} onError={onError} />

      <Card title={<SectionHeader icon={<MailOutlined />} title="Invite by email" subtitle="Upload a .txt of emails (one per line) or paste them. Each gets an email with a link to set their name + password. (Requires SMTP in Settings → Mail.)" />}>
        <form action={action}>
          <input type="hidden" name="cohortId" value={cohort.id} />
          <FormLayout>
            <Form.Item label="Upload .txt (one email per line)">
              <FileField name="emailsFile" accept=".txt,text/plain" label="Select .txt file" />
            </Form.Item>
            <Form.Item label="…or paste emails">
              <Textarea name="emailsText" mono rows={5} placeholder={'ada@example.com\nalan@example.com'} />
            </Form.Item>
            <Flex vertical gap={12}>
              <FormStatus state={state} />
              <Flex justify="flex-end">
                <Button type="primary" htmlType="submit" loading={sending} icon={<SendOutlined />}>Send invitations</Button>
              </Flex>
            </Flex>
          </FormLayout>
        </form>
      </Card>

      <Card
        title={<SectionHeader icon={<ClockCircleOutlined />} title={`Pending invitations (${invitations.length})`} subtitle="Awaiting the student to accept." />}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          dataSource={invitations}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No pending invitations." /> }}
          columns={[
            { title: 'Email', dataIndex: 'email', key: 'email', render: (v) => <Typography.Text strong>{v}</Typography.Text> },
            { title: 'Sent', dataIndex: 'created', key: 'created', width: 120, sorter: (a, b) => a.created.localeCompare(b.created) },
            { title: 'Expires', dataIndex: 'expires', key: 'expires', width: 120, sorter: (a, b) => a.expires.localeCompare(b.expires) },
            {
              title: '', key: 'actions', align: 'right', width: 120,
              render: (_v, row) => (
                <Popconfirm title="Revoke this invitation?" okText="Revoke" okButtonProps={{ danger: true }} onConfirm={() => revoke(row)}>
                  <Button size="small" type="text" danger loading={busyId === row.id} icon={<CloseOutlined />}>Revoke</Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>
    </Flex>
  );
}

function ScenariosTab({ cohort, bound, allScenarios, onError }) {
  const [bindOpen, setBindOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const boundIds = new Set(bound.map((b) => b.scenarioId));

  const unbind = async (b) => {
    setBusyId(b.bindingId);
    const res = await unbindScenario(b.bindingId);
    setBusyId(null);
    if (res?.error) onError(res.error);
  };

  return (
    <>
      <Card
        title={<SectionHeader icon={<AppstoreOutlined />} title="Bound scenarios" subtitle="Released to this cohort's students — including hidden dojos." />}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setBindOpen(true)}>Bind scenario</Button>}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="bindingId"
          dataSource={bound}
          pagination={false}
          locale={{
            emptyText: (
              <Empty description="No scenarios bound — bind a scenario to release it to this cohort.">
                <Button type="primary" onClick={() => setBindOpen(true)}>Bind scenario</Button>
              </Empty>
            ),
          }}
          columns={[
            { title: 'Scenario', dataIndex: 'title', key: 'title', sorter: (a, b) => a.title.localeCompare(b.title), render: (v) => <Typography.Text strong>{v}</Typography.Text> },
            {
              title: 'Type', dataIndex: 'type', key: 'type', width: 140,
              filters: Object.entries(TYPE_META).map(([value, m]) => ({ text: m.label, value })),
              onFilter: (value, row) => row.type === value,
              render: (v) => <TypeTag type={v} />,
            },
            {
              title: '', key: 'actions', align: 'right', width: 120,
              render: (_v, row) => (
                <Popconfirm title={`Unbind "${row.title}"?`} description="Students in this cohort lose access to it." okText="Unbind" onConfirm={() => unbind(row)}>
                  <Button size="small" type="text" loading={busyId === row.bindingId} icon={<DisconnectOutlined />}>Unbind</Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>

      <BindDialog open={bindOpen} onClose={() => setBindOpen(false)} cohortId={cohort.id} scenarios={allScenarios.filter((s) => !boundIds.has(s.id))} onError={onError} />
    </>
  );
}

function BindDialog({ open, onClose, cohortId, scenarios, onError }) {
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (selected.length === 0) { onError('Select at least one scenario.'); return; }
    setBusy(true);
    const res = await bindScenarios(cohortId, [...selected]);
    setBusy(false);
    if (res?.error) { onError(res.error); return; }
    setSelected([]);
    onClose();
  };

  return (
    <Modal
      open={open}
      width={620}
      title={<Flex align="center" gap={8}><LinkOutlined />Bind scenarios</Flex>}
      onCancel={onClose}
      onOk={submit}
      okText={`Bind${selected.length ? ` (${selected.length})` : ''}`}
      okButtonProps={{ disabled: scenarios.length === 0 }}
      confirmLoading={busy}
    >
      <Typography.Paragraph type="secondary">Selected scenarios become visible to this cohort&apos;s students.</Typography.Paragraph>
      <Table
        size="small"
        rowKey="id"
        dataSource={scenarios}
        pagination={false}
        scroll={{ y: 320 }}
        rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys) }}
        onRow={(row) => ({
          onClick: () => setSelected((p) => (p.includes(row.id) ? p.filter((k) => k !== row.id) : [...p, row.id])),
          style: { cursor: 'pointer' },
        })}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="All authored scenarios are already bound to this cohort." /> }}
        columns={[
          { title: 'Scenario', dataIndex: 'title', key: 'title' },
          { title: 'Type', dataIndex: 'type', key: 'type', width: 130, render: (v) => <TypeTag type={v} /> },
        ]}
      />
    </Modal>
  );
}

function GradingTab({ submissions, onError }) {
  const router = useRouter();
  const [grading, setGrading] = useState(null); // submission row

  return (
    <>
      <Card
        title={<SectionHeader icon={<EditOutlined />} title="Submissions" subtitle="Deliverables submitted by this cohort's students, awaiting or holding a grade." />}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          dataSource={submissions}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          onRow={(row) => ({ onClick: () => setGrading(row), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <Empty description="No submissions yet — they appear once students complete bound scenarios and submit their deliverables." /> }}
          columns={[
            { title: 'Student', dataIndex: 'studentName', key: 'studentName', sorter: (a, b) => a.studentName.localeCompare(b.studentName), render: (v) => <Typography.Text strong>{v}</Typography.Text> },
            { title: 'Scenario', dataIndex: 'scenarioTitle', key: 'scenarioTitle' },
            { title: 'Submitted', dataIndex: 'submitted', key: 'submitted', width: 120, sorter: (a, b) => a.submitted.localeCompare(b.submitted) },
            { title: 'Status', key: 'status', width: 170, render: (_v, row) => <GradeState row={row} /> },
            {
              title: '', key: 'actions', align: 'right', width: 110,
              render: (_v, row) => (
                <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); setGrading(row); }}>
                  {row.status === 'GRADED' ? 'Review' : row.committed ? 'Grade' : 'Review'}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <GradeReviewDialog key={grading?.id || 'none'} submission={grading} onClose={() => setGrading(null)} onError={onError} onDone={() => router.refresh()} />
    </>
  );
}

const MEDAL = ['#D4A017', '#A0A7B4', '#B87333'];

function StandingsTab({ leaderboard }) {
  const rows = (leaderboard || []).map((r, i) => ({ ...r, rank: i + 1 }));
  return (
    <Card
      title={<SectionHeader icon={<TrophyOutlined />} title="Standings" subtitle="Reputation earned from graded assessments, highest first." />}
      styles={{ body: { padding: 0 } }}
    >
      <Table
        rowKey="id"
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: <Empty description="No standings yet — reputation appears once assessment submissions are graded." /> }}
        columns={[
          {
            title: '#', dataIndex: 'rank', key: 'rank', width: 64,
            render: (v) => (v <= 3 ? <Space size={6}><CrownFilled style={{ color: MEDAL[v - 1] }} />{v}</Space> : v),
          },
          { title: 'Student', dataIndex: 'name', key: 'name', render: (v) => <Typography.Text strong>{v}</Typography.Text> },
          { title: 'Assessments', dataIndex: 'assessments', key: 'assessments', align: 'right', width: 140 },
          { title: 'Reputation', dataIndex: 'reputation', key: 'reputation', align: 'right', width: 140, render: (v) => <Tag color="gold">{v}</Tag> },
        ]}
      />
    </Card>
  );
}

export default CohortDetail;
