'use client';
import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert, App, Badge, Button, Card, Col, Collapse, Flex, Layout, Popconfirm, Progress, Result, Row, Select, Spin, Tag, Tooltip, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleFilled, ClockCircleOutlined, CloseCircleFilled, CloudServerOutlined, CodeOutlined,
  ExperimentOutlined, FlagOutlined, MinusCircleOutlined, PlayCircleOutlined, StopOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { Markdown } from '@/components/Markdown';
import { TechniqueTags } from '@/components/attack/TechniqueTags';
import { StudentTopBar } from '@/components/screens/student/StudentTopBar';
import { StackList } from '@/components/ds/StackList';
import { cancelLab, checkLab, endLab, startLab } from '@/app/actions/labs';
import { osLabel, osName, roleMismatch } from '@/lib/labs/os';
import { useNow } from './clock';

const { Text, Paragraph } = Typography;

const TYPE_TAG = { DOJO: { color: 'cyan', label: 'Dojo' }, ASSESSMENT: { color: 'purple', label: 'Assessment' } };
const RUNNING = ['PREPARING', 'ACTIVE', 'ENDING'];

function countdown(iso, now) {
  if (!iso || now == null) return null;
  const s = Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s % 60).padStart(2, '0')}`;
}

/* A LAB scenario for the student: brief (with their own values), session
   controls (start → check → finish) and results. The same actions are
   available on the machine as `sudo zaio start|check|end <lab>`. */
export function LabWorkspace({ user, scenario, slug, brief, roles, policy, machines, defaults, view, history, submission }) {
  const router = useRouter();
  const typeTag = TYPE_TAG[scenario.type] || TYPE_TAG.DOJO;
  const running = view && RUNNING.includes(view.status);
  const busy = view && (view.status === 'PREPARING' || view.status === 'ENDING' || view.runs[0]?.status === 'COLLECTING');

  // Refresh quickly while machines are working, slowly otherwise (deadline, other devices).
  useEffect(() => {
    const t = setInterval(() => router.refresh(), busy ? 2000 : 15000);
    return () => clearInterval(t);
  }, [router, busy]);

  const left = (
    <Flex align="center" gap={10} style={{ minWidth: 0 }}>
      <Tooltip title="Back to dashboard">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.push('/learn')} />
      </Tooltip>
      <Text strong ellipsis style={{ fontSize: 15, maxWidth: 360 }}>{scenario.title}</Text>
      <Tag color={typeTag.color} style={{ marginInlineEnd: 0 }}>{typeTag.label}</Tag>
      <Tag color="purple" icon={<CloudServerOutlined />} style={{ marginInlineEnd: 0 }}>Lab</Tag>
    </Flex>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <StudentTopBar user={user} left={left} />
      <Layout.Content style={{ padding: 24 }}>
        <Row gutter={[20, 20]} style={{ maxWidth: 1280, margin: '0 auto' }}>
          <Col xs={24} lg={14}>
            <Flex vertical gap={16}>
              <Card title={<Flex gap={8} align="center"><ExperimentOutlined />Brief</Flex>}>
                {scenario.description && <Paragraph type="secondary">{scenario.description}</Paragraph>}
                {scenario.techniques?.length > 0 && <TechniqueTags ids={scenario.techniques} style={{ marginBottom: 12 }} />}
                <Markdown>{brief || '_No brief._'}</Markdown>
              </Card>
              <OnTheMachine slug={slug} />
            </Flex>
          </Col>
          <Col xs={24} lg={10}>
            <Flex vertical gap={16} style={{ position: 'sticky', top: 16 }}>
              {submission && scenario.type === 'ASSESSMENT' && <SubmissionNote submission={submission} />}
              {running ? (
                <SessionCard view={view} policy={policy} />
              ) : (
                <StartCard scenario={scenario} roles={roles} machines={machines} defaults={defaults} policy={policy} last={view} committed={submission?.committed} />
              )}
              {view && view.runs.length > 0 && <RunsCard view={view} />}
              {history.length > 0 && <HistoryCard history={history} />}
            </Flex>
          </Col>
        </Row>
      </Layout.Content>
    </Layout>
  );
}

function useAction() {
  const { message } = App.useApp();
  const [pending, start] = useTransition();
  const call = (fn) => start(async () => {
    const res = await fn();
    if (res?.error) message.error(res.error);
  });
  return [pending, call];
}

function StartCard({ scenario, roles, machines, defaults, policy, last, committed }) {
  const [assignments, setAssignments] = useState(defaults);
  const [pending, call] = useAction();
  const lastNote = last && !RUNNING.includes(last.status) ? last : null;

  if (committed) {
    return <Card><Result status="info" title="Locked for grading" subTitle="Your instructor has locked this assessment, so it can't be redone." /></Card>;
  }
  return (
    <Card title={<Flex gap={8} align="center"><PlayCircleOutlined />{lastNote ? 'Start again' : 'Start the lab'}</Flex>}>
      <Flex vertical gap={14}>
        {lastNote?.status === 'ABORTED' && lastNote.note && <Alert type="warning" showIcon title="The last session didn't start" description={lastNote.note} />}
        {lastNote?.status === 'EXPIRED' && <Alert type="warning" showIcon title="The last session expired" description={lastNote.note} />}
        {policy.lockdown && (
          <Alert
            type="warning"
            showIcon
            title="SSH is turned off during this lab"
            description="Work on the machine's own console (the VirtualBox window), and start from there too: an SSH connection open at the start is noted for your instructor. SSH comes back on when you finish."
          />
        )}
        {machines.length === 0 ? (
          <Alert
            type="info"
            showIcon
            title="Link a machine first"
            description={<>This lab runs on your own {[...new Set(roles.map((r) => osName(r.os)))].join(' and ')} VM{roles.length > 1 ? 's' : ''}. <Link href="/machines">Add a machine</Link>, then come back.</>}
          />
        ) : (
          roles.map(({ role, os, versions }) => {
            const chosen = machines.find((m) => m.id === assignments[role]);
            return (
              <Flex key={role} vertical gap={4}>
                <Text strong>
                  {roles.length > 1 ? `Machine for "${role}"` : 'Machine'}
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal', marginInlineStart: 8 }}>{osName(os)}{versions.length ? ` ${versions.join(' / ')}` : ''}</Text>
                </Text>
                <Select
                  value={assignments[role]}
                  onChange={(v) => setAssignments((a) => ({ ...a, [role]: v }))}
                  placeholder="Choose one of your machines"
                  options={machines.map((m) => ({
                    value: m.id,
                    disabled: roleMismatch(role, { os, versions }, m) !== null,
                    label: (
                      <Flex gap={8} align="center">
                        <Badge status={m.online ? 'success' : 'default'} />
                        <span>{m.label}</span>
                        <Text type="secondary" style={{ fontSize: 12 }}>{osLabel(m.os, m.osVersion)}</Text>
                      </Flex>
                    ),
                  }))}
                />
                {chosen && !chosen.online && <Text type="warning" style={{ fontSize: 12 }}>This machine looks offline. Turn it on before starting.</Text>}
                {chosen?.missing.length > 0 && (
                  <Text type="danger" style={{ fontSize: 12 }}>Its agent needs an update for this lab: run the install command from the Machines page again.</Text>
                )}
              </Flex>
            );
          })
        )}
        <Text type="secondary" style={{ fontSize: 13 }}>
          Starting records the state of your machine{roles.length > 1 ? 's' : ''} first, so only what you change during the session counts.
          {policy.timeLimitMinutes ? ` You'll have ${policy.timeLimitMinutes} minutes.` : ''}
          {scenario.type === 'ASSESSMENT' ? ' Your latest finished session is your submission.' : ''}
        </Text>
        <Button
          type="primary"
          size="large"
          icon={<PlayCircleOutlined />}
          loading={pending}
          disabled={machines.length === 0 || roles.some(({ role }) => !assignments[role])}
          onClick={() => call(() => startLab(scenario.id, assignments))}
        >
          Start lab
        </Button>
      </Flex>
    </Card>
  );
}

function SessionCard({ view, policy }) {
  const now = useNow();
  const [pending, call] = useAction();
  const latest = view.runs[0];
  const checking = latest?.status === 'COLLECTING';
  const left = countdown(view.deadlineAt, now);
  const practiceLeft = policy.practice ? view.practice.max - view.practice.used : 0;

  return (
    <Card
      title={<Flex gap={8} align="center"><Badge status={view.status === 'ACTIVE' ? 'processing' : 'warning'} />Session {view.status === 'ACTIVE' ? 'running' : view.status === 'PREPARING' ? 'starting' : 'finishing'}</Flex>}
      extra={left && <Tag icon={<ClockCircleOutlined />} color={now && new Date(view.deadlineAt).getTime() - now < 10 * 60_000 ? 'red' : 'default'} style={{ margin: 0 }}>{left} left</Tag>}
    >
      <Flex vertical gap={14}>
        {view.problems.length > 0 && (
          <Alert type="error" showIcon title="A machine had a problem" description={view.problems.map((p) => <div key={p}>{p}</div>)} />
        )}
        {view.status === 'PREPARING' && (
          <Flex gap={12} align="center">
            <Spin />
            <Text>Recording the starting state of {view.waitingOn.length ? view.waitingOn.join(', ') : 'your machine'}…</Text>
          </Flex>
        )}
        {view.status === 'ENDING' && (
          <Flex gap={12} align="center">
            <Spin />
            <Text>Final check: collecting your work{view.waitingOn.length ? ` from ${view.waitingOn.join(', ')}` : ''}…</Text>
          </Flex>
        )}
        {view.status === 'ACTIVE' && (
          <>
            <Text>Do the tasks in the brief on {view.machines.map((m) => m.label).join(' and ')}. Check your work as often as you like, then finish to be graded.</Text>
            {policy.lockdown && <Text type="warning" style={{ fontSize: 13 }}>SSH is off on your machine until you finish. Use its console.</Text>}
            {checking && (
              <Flex gap={12} align="center"><Spin size="small" /><Text>Checking your work{view.waitingOn.length ? ` on ${view.waitingOn.join(', ')}` : ''}…</Text></Flex>
            )}
            <Flex gap={8} wrap>
              {policy.practice && (
                <Tooltip title={practiceLeft <= 0 ? 'No practice checks left' : `${practiceLeft} practice check${practiceLeft === 1 ? '' : 's'} left`}>
                  <Button icon={<ExperimentOutlined />} loading={pending && !checking} disabled={checking || practiceLeft <= 0} onClick={() => call(() => checkLab(view.id))}>
                    Check my work
                  </Button>
                </Tooltip>
              )}
              <Popconfirm
                title="Finish the lab?"
                description="Your work is collected one last time and graded. The session then ends."
                okText="Finish"
                onConfirm={() => call(() => endLab(view.id))}
              >
                <Button type="primary" icon={<FlagOutlined />} disabled={checking}>Finish lab</Button>
              </Popconfirm>
            </Flex>
          </>
        )}
        {view.status === 'PREPARING' && (
          <Popconfirm title="Cancel this session?" okText="Cancel session" okButtonProps={{ danger: true }} onConfirm={() => call(() => cancelLab(view.id))}>
            <Button danger icon={<StopOutlined />} style={{ alignSelf: 'flex-start' }}>Cancel</Button>
          </Popconfirm>
        )}
      </Flex>
    </Card>
  );
}

function CheckRow({ c }) {
  const icon = c.skipped
    ? <MinusCircleOutlined style={{ color: 'var(--ath-color-text-tertiary)' }} />
    : c.passed ? <CheckCircleFilled style={{ color: 'var(--ath-color-success)' }} /> : <CloseCircleFilled style={{ color: 'var(--ath-color-error)' }} />;
  return (
    <Flex vertical gap={4}>
      <Flex gap={10} align="baseline" justify="space-between">
        <Flex gap={10} align="baseline">{icon}<Text strong={!c.passed && !c.skipped}>{c.title}</Text></Flex>
        <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{c.skipped ? 'skipped' : `${c.points}/${c.max}`}</Text>
      </Flex>
      {!c.passed && !c.skipped && (
        <Flex vertical gap={2} style={{ paddingLeft: 24 }}>
          {c.assertions.map((a) => (
            <Text key={a.label} type={a.passed ? 'secondary' : undefined} style={{ fontSize: 13 }}>
              {a.passed ? '✓' : '✗'} {a.label} <Text type="secondary" style={{ fontSize: 12 }}>({a.points}/{a.max})</Text>
            </Text>
          ))}
          {c.reason && <Text type="danger" style={{ fontSize: 13 }}>{c.reason}</Text>}
          {c.hint && <Text type="secondary" style={{ fontSize: 13 }}>Hint: {c.hint}</Text>}
        </Flex>
      )}
    </Flex>
  );
}

function RunResult({ run }) {
  if (run.status === 'COLLECTING') return <Flex gap={8}><Spin size="small" /><Text type="secondary">Collecting…</Text></Flex>;
  if (!run.visible) return <Text type="secondary">Your work was collected. Results appear once your instructor releases them.</Text>;
  return <StackList items={run.checks} rowKey={(c) => c.id} renderItem={(c) => <CheckRow c={c} />} />;
}

function RunsCard({ view }) {
  const [latest, ...older] = view.runs;
  const pct = latest.visible && latest.maxScore ? Math.round((latest.score / latest.maxScore) * 100) : null;
  return (
    <Card
      title={<Flex gap={8} align="center">{latest.final ? <TrophyOutlined /> : <ExperimentOutlined />}{latest.final ? 'Final result' : 'Latest check'}</Flex>}
      extra={pct !== null && latest.status === 'GRADED' && (
        <Flex align="center" gap={8}>
          <Progress type="circle" size={34} percent={pct} status={pct === 100 ? 'success' : 'normal'} />
          <Text strong>{latest.score}/{latest.maxScore}</Text>
        </Flex>
      )}
    >
      {latest.adjusted && <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Your instructor adjusted this score." />}
      <RunResult run={latest} />
      {older.length > 0 && (
        <Collapse
          ghost
          size="small"
          style={{ marginTop: 12 }}
          items={older.map((r) => ({
            key: r.id,
            label: (
              <Flex justify="space-between" style={{ width: '100%' }}>
                <span>{r.final ? 'Final check' : 'Practice check'} · {new Date(r.requestedAt).toLocaleTimeString()}</span>
                {r.visible && r.score != null && <Text type="secondary">{r.score}/{r.maxScore}</Text>}
              </Flex>
            ),
            children: <RunResult run={r} />,
          }))}
        />
      )}
    </Card>
  );
}

function HistoryCard({ history }) {
  const label = { ENDED: 'Finished', EXPIRED: 'Expired', ABORTED: 'Didn’t start' };
  return (
    <Card size="small" title="Earlier sessions">
      <StackList
        items={history}
        rowKey={(h) => h.id}
        renderItem={(h) => (
          <Flex justify="space-between">
            <Text>{new Date(h.endedAt).toLocaleString()}</Text>
            <Text type="secondary">{label[h.status] ?? h.status}{h.score != null ? ` · ${h.score}/${h.maxScore}` : ''}</Text>
          </Flex>
        )}
      />
    </Card>
  );
}

function SubmissionNote({ submission }) {
  if (submission.released) {
    return (
      <Alert
        type="success"
        showIcon
        title={`Graded: ${submission.grade ?? '—'} / 100`}
        description={submission.feedback ? <Markdown>{submission.feedback}</Markdown> : undefined}
      />
    );
  }
  return (
    <Alert
      type="info"
      showIcon
      title={submission.committed ? 'Submitted and locked for grading' : 'Submitted'}
      description={submission.committed ? 'Your instructor is grading it.' : 'Your latest finished session is your submission. You can redo the lab until your instructor locks it.'}
    />
  );
}

function OnTheMachine({ slug }) {
  return (
    <Card size="small" title={<Flex gap={8} align="center"><CodeOutlined />On the machine</Flex>}>
      <Paragraph type="secondary" style={{ marginBottom: 8 }}>Prefer the terminal? The same controls work there:</Paragraph>
      <Flex vertical gap={4}>
        {[['start', 'start the session'], ['check', 'check your work so far'], ['end', 'finish and be graded']].map(([cmd, what]) => (
          <Flex key={cmd} gap={10} align="baseline" wrap>
            <Text code copyable>{`sudo zaio ${cmd} ${slug}`}</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>{what}</Text>
          </Flex>
        ))}
      </Flex>
    </Card>
  );
}

export default LabWorkspace;
