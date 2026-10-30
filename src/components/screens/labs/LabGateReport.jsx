'use client';
import React from 'react';
import { Alert, Card, Collapse, Flex, Progress, Table, Tag, Tooltip, Typography } from 'antd';
import { StackList } from '@/components/ds/StackList';
import { CheckCircleFilled, CloseCircleFilled, FlagFilled, MinusCircleOutlined, WarningOutlined } from '@ant-design/icons';

const { Text } = Typography;

const where = (i) => `${i.file}${i.line ? `:${i.line}` : ''}`;

/* The result of checking a lab folder: problems to fix, warnings, and how the
   good / broken reference evidence graded (docs/labs/spec.md section 11). */
export function LabGateReport({ report }) {
  if (!report) return null;
  const { errors = [], warnings = [], gate = {}, scripts = [] } = report;
  return (
    <Flex vertical gap={16}>
      {errors.length > 0 && (
        <Card size="small" title={<Flex gap={8} align="center"><CloseCircleFilled style={{ color: 'var(--ath-color-error)' }} />Fix {errors.length} problem{errors.length === 1 ? '' : 's'}</Flex>}>
          <IssueList items={errors} />
        </Card>
      )}
      {gate.good && <GateRunCard title="Good reference" subtitle="Built from the answer key — must score full marks" run={gate.good} />}
      {gate.broken && <GateRunCard title="Broken reference" subtitle="Nothing done — must fail the expected checks" run={gate.broken} expectations={gate.broken.expectations} />}
      {scripts.length > 0 && (
        <Card size="small" title={`${scripts.length} script${scripts.length === 1 ? '' : 's'} for the brief`}>
          <Flex gap={8} wrap>
            {scripts.map((s) => <Tag key={s.name} style={{ margin: 0 }}><Text code style={{ fontSize: 12 }}>{`{{script.${s.name}}}`}</Text> {s.file} · {s.size} B</Tag>)}
          </Flex>
        </Card>
      )}
      {warnings.length > 0 && (
        <Collapse
          size="small"
          items={[{
            key: 'w',
            label: <Flex gap={8} align="center"><WarningOutlined style={{ color: 'var(--ath-color-warning)' }} />{warnings.length} warning{warnings.length === 1 ? '' : 's'}</Flex>,
            children: <IssueList items={warnings} />,
          }]}
        />
      )}
    </Flex>
  );
}

function IssueList({ items }) {
  return (
    <StackList
      items={items}
      renderItem={(i) => (
        <Flex vertical gap={2}>
          <Text code style={{ fontSize: 12, alignSelf: 'flex-start' }}>{where(i)}{i.path ? ` · ${i.path}` : ''}</Text>
          <Text>{i.message}</Text>
        </Flex>
      )}
    />
  );
}

function GateRunCard({ title, subtitle, run, expectations }) {
  const full = run.score === run.maxScore;
  const expectedOk = expectations ? expectations.every((e) => e.ok) : null;
  const expected = new Map((expectations || []).map((e) => [e.check, e]));
  return (
    <Card
      size="small"
      title={<Flex vertical gap={0}><Text strong>{title}</Text><Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>{subtitle}</Text></Flex>}
      extra={
        <Flex align="center" gap={10}>
          <Progress type="circle" size={36} percent={Math.round((run.score / Math.max(run.maxScore, 1)) * 100)} status={expectations ? 'normal' : full ? 'success' : 'exception'} />
          <Text strong>{run.score}/{run.maxScore}</Text>
          {expectedOk !== null && <Tag color={expectedOk ? 'success' : 'error'} style={{ margin: 0 }}>{expectedOk ? 'as expected' : 'unexpected'}</Tag>}
        </Flex>
      }
      styles={{ body: { padding: 0 } }}
    >
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={run.checks}
        columns={[
          {
            title: 'Check', dataIndex: 'title',
            render: (v, c) => (
              <Flex vertical gap={0}>
                <Text>{v}</Text>
                <Text type="secondary" style={{ fontSize: 12, fontFamily: 'var(--ath-font-family-code)' }}>{c.id}</Text>
              </Flex>
            ),
          },
          {
            title: 'Result', key: 'r', width: 150,
            render: (_, c) => {
              if (c.skipped) return <Tag icon={<MinusCircleOutlined />}>skipped</Tag>;
              if (c.max === 0) return c.flagged ? <Tag icon={<FlagFilled />} color="warning">flag raised</Tag> : <Tag>no flag</Tag>;
              return c.passed ? <Tag icon={<CheckCircleFilled />} color="success">pass</Tag> : <Tag icon={<CloseCircleFilled />} color="error">fail</Tag>;
            },
          },
          { title: 'Points', key: 'p', width: 80, align: 'right', render: (_, c) => (c.max ? `${c.points}/${c.max}` : '—') },
          {
            title: 'Why', key: 'why',
            render: (_, c) => {
              const e = expected.get(c.id) || (c.max === 0 ? [...expected.values()].find((x) => x.expected === 'flag') : null);
              return (
                <Flex vertical gap={2}>
                  {e && <Text type={e.ok ? 'success' : 'danger'} style={{ fontSize: 12 }}>expected to {e.expected}{e.ok ? '' : ' — did not'}</Text>}
                  {c.reason && <Text type="secondary" style={{ fontSize: 12 }}>{c.reason}</Text>}
                  {c.detail?.length > 0 && (
                    <Tooltip title={<pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 11 }}>{c.detail.join('\n')}</pre>}>
                      <Text type="secondary" style={{ fontSize: 12, textDecoration: 'underline dotted' }}>{c.detail.length} evaluation note{c.detail.length === 1 ? '' : 's'}</Text>
                    </Tooltip>
                  )}
                </Flex>
              );
            },
          },
        ]}
      />
      {!expectations && !full && (
        <Alert type="error" showIcon banner title="The good reference must score full marks before the lab is accepted." />
      )}
    </Card>
  );
}

export default LabGateReport;
