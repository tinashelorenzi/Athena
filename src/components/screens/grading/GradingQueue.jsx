'use client';
import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Badge, Button, Card, Col, Empty, Flex, Input, Row, Select, Statistic, Table, Typography, theme } from 'antd';
import {
  EditOutlined, InboxOutlined, EyeInvisibleOutlined, CheckCircleOutlined, LockOutlined, SearchOutlined, FormOutlined,
} from '@ant-design/icons';
import { setSubmissionCommitted } from '@/app/actions/grading';
import { GradeReviewDialog } from './GradeReviewDialog';
import { GradeState, Page, TypeTag, gradeStateOf as stateOf } from '../settings/parts';

const EMPTY_TEXT = {
  open: 'No submissions are open for re-do.',
  committed: 'No committed submissions are waiting to be graded.',
  held: 'No graded submissions are being held.',
};

/* Cross-cohort grading queue. Lifecycle: open (student can re-do) → committed
   (locked, to grade) → held (graded, not released) → released. */
export function GradingQueue({ items }) {
  const router = useRouter();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const counts = useMemo(() => {
    const c = { open: 0, committed: 0, held: 0, released: 0 };
    for (const i of items) c[stateOf(i)] += 1;
    return { ...c, all: items.length };
  }, [items]);

  const [tab, setTab] = useState(() => (counts.committed ? 'committed' : counts.open ? 'open' : 'all'));
  const [q, setQ] = useState('');
  const [cohort, setCohort] = useState('');
  const [reviewing, setReviewing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const cohorts = useMemo(() => [...new Set(items.map((i) => i.cohortName))].sort(), [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => {
      if (tab !== 'all' && stateOf(i) !== tab) return false;
      if (cohort && i.cohortName !== cohort) return false;
      if (s && !(`${i.studentName} ${i.scenarioTitle} ${i.cohortName}`.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [items, tab, q, cohort]);

  const commit = async (row) => {
    setBusyId(row.id);
    const res = await setSubmissionCommitted(row.id, true);
    setBusyId(null);
    if (res?.error) { message.error(res.error); return; }
    message.success(`Committed ${row.studentName}'s submission for grading.`);
    router.refresh();
  };

  const tabLabel = (label, n) => (
    <Flex align="center" gap={8}>{label}<Badge count={n} showZero color={n ? token.colorPrimary : token.colorTextQuaternary} size="small" /></Flex>
  );
  const tabList = [
    { key: 'open', label: tabLabel('Open', counts.open) },
    { key: 'committed', label: tabLabel('To grade', counts.committed) },
    { key: 'held', label: tabLabel('Held', counts.held) },
    { key: 'released', label: tabLabel('Released', counts.released) },
    { key: 'all', label: tabLabel('All', counts.all) },
  ];

  const columns = [
    {
      title: 'Student', dataIndex: 'studentName', key: 'studentName',
      sorter: (a, b) => a.studentName.localeCompare(b.studentName),
      render: (v) => <Typography.Text strong>{v}</Typography.Text>,
    },
    { title: 'Cohort', dataIndex: 'cohortName', key: 'cohortName', width: 160 },
    {
      title: 'Scenario', dataIndex: 'scenarioTitle', key: 'scenarioTitle',
      render: (v, row) => <Flex align="center" gap={8} wrap>{v}<TypeTag type={row.scenarioType} /></Flex>,
    },
    {
      title: 'Flags', key: 'flags', width: 80, align: 'center',
      render: (_v, row) => (row.flagsTotal ? `${row.flagsCorrect}/${row.flagsTotal}` : '—'),
    },
    {
      title: 'Auto', dataIndex: 'autoGrade', key: 'autoGrade', width: 80, align: 'center',
      sorter: (a, b) => (a.autoGrade ?? -1) - (b.autoGrade ?? -1),
      render: (v) => (v == null ? '—' : v),
    },
    {
      title: 'Submitted', dataIndex: 'submitted', key: 'submitted', width: 120,
      sorter: (a, b) => a.submitted.localeCompare(b.submitted), defaultSortOrder: 'descend',
      render: (v) => v.slice(0, 10),
    },
    { title: 'State', key: 'state', width: 150, render: (_v, row) => <GradeState row={row} /> },
    {
      title: '', key: 'actions', width: 120, align: 'right',
      render: (_v, row) => {
        const st = stateOf(row);
        if (st === 'open') {
          return (
            <Button type="primary" size="small" loading={busyId === row.id} icon={<LockOutlined />}
              onClick={(e) => { e.stopPropagation(); commit(row); }}>Commit</Button>
          );
        }
        return (
          <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); setReviewing(row); }}>
            {st === 'committed' ? 'Grade' : 'Review'}
          </Button>
        );
      },
    },
  ];

  const stats = [
    { key: 'open', title: 'Open', value: counts.open, icon: <FormOutlined />, hint: 'Student can still re-do', color: token.colorPrimary },
    { key: 'committed', title: 'To grade', value: counts.committed, icon: <InboxOutlined />, hint: 'Committed, awaiting a grade', color: counts.committed ? token.colorWarning : undefined },
    { key: 'held', title: 'Held', value: counts.held, icon: <EyeInvisibleOutlined />, hint: 'Graded, not released' },
    { key: 'released', title: 'Released', value: counts.released, icon: <CheckCircleOutlined />, hint: 'Visible to students', color: counts.released ? token.colorSuccess : undefined },
  ];

  return (
    <Page
      title="Grading queue"
      description={<>Students can keep re-doing an assessment until you <Typography.Text strong>commit</Typography.Text> it. Committing locks it for grading; then grade, amend, and release.</>}
    >
      <Row gutter={[16, 16]}>
        {stats.map((s) => (
          <Col key={s.key} xs={12} lg={6}>
            <Card hoverable onClick={() => setTab(s.key)} style={tab === s.key ? { borderColor: token.colorPrimary } : undefined}>
              <Statistic title={s.title} value={s.value} prefix={s.icon} styles={{ content: s.color ? { color: s.color } : undefined }} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{s.hint}</Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        tabList={tabList}
        activeTabKey={tab}
        onTabChange={setTab}
        tabBarExtraContent={
          <Flex gap={8} wrap>
            <Select
              value={cohort}
              onChange={setCohort}
              style={{ width: 180 }}
              options={[{ value: '', label: 'All cohorts' }, ...cohorts.map((c) => ({ value: c, label: c }))]}
            />
            <Input allowClear prefix={<SearchOutlined />} placeholder="Search student / scenario…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 230 }} />
          </Flex>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 25, hideOnSinglePage: true }}
          onRow={(row) => ({ onClick: () => setReviewing(row), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <Empty description={EMPTY_TEXT[tab] || 'No submissions match.'} /> }}
        />
      </Card>

      <GradeReviewDialog
        key={reviewing?.id || 'none'}
        submission={reviewing}
        onClose={() => setReviewing(null)}
        onError={(e) => message.error(e)}
        onDone={() => router.refresh()}
      />
    </Page>
  );
}

export default GradingQueue;
