'use client';
import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, App, Badge, Button, Collapse, Descriptions, Drawer, Empty, Flex, Input, InputNumber, Popconfirm, Segmented, Select, Skeleton, Space,
  Switch, Table, Tabs, Tag, Timeline, Tooltip, Typography,
} from 'antd';
import { CheckCircleFilled, CloseCircleFilled, DownloadOutlined, FlagFilled, MinusCircleOutlined, SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons';
import { labSessionDetail, overrideLabScore, saveLabReference } from '@/app/actions/lab-admin';
import { flagInfo } from './flags';

const { Text, Paragraph } = Typography;

const STATUS = {
  PREPARING: { color: 'processing', label: 'Starting' },
  ACTIVE: { color: 'processing', label: 'Running' },
  ENDING: { color: 'warning', label: 'Finishing' },
  ENDED: { color: 'success', label: 'Finished' },
  EXPIRED: { color: 'default', label: 'Expired' },
  ABORTED: { color: 'default', label: 'Didn’t start' },
};

const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
const scoreText = (s, max) => (s == null || max == null ? '—' : `${s}/${max}`);

export function FlagTags({ flags, definition }) {
  if (!flags?.length) return null;
  return (
    <Flex gap={4} wrap>
      {flags.map((f) => (
        <Tooltip key={f} title={flagInfo(f, definition)}>
          <Tag color="red" icon={<FlagFilled />} style={{ margin: 0 }}>{f}</Tag>
        </Tooltip>
      ))}
    </Flex>
  );
}

/* Every session of a lab, across students and versions, with flags. */
export function LabSessions({ sessions, definition }) {
  const [query, setQuery] = useState('');
  const [cohort, setCohort] = useState(null);
  const [status, setStatus] = useState('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [openId, setOpenId] = useState(null);

  const cohorts = useMemo(() => [...new Set(sessions.map((s) => s.cohort).filter(Boolean))].sort(), [sessions]);
  const rows = useMemo(() => sessions.filter((s) => {
    const q = query.trim().toLowerCase();
    if (q && !`${s.student} ${s.email} ${s.studentNumber ?? ''}`.toLowerCase().includes(q)) return false;
    if (cohort && s.cohort !== cohort) return false;
    if (status === 'finished' && s.status !== 'ENDED') return false;
    if (status === 'running' && !['PREPARING', 'ACTIVE', 'ENDING'].includes(s.status)) return false;
    if (flaggedOnly && !s.flags.length) return false;
    return true;
  }), [sessions, query, cohort, status, flaggedOnly]);
  const flagged = sessions.filter((s) => s.flags.length).length;

  return (
    <Flex vertical gap={12}>
      <Flex gap={10} wrap align="center">
        <Input allowClear prefix={<SearchOutlined />} placeholder="Student, email or number" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 260 }} />
        <Select allowClear placeholder="All cohorts" value={cohort} onChange={setCohort} options={cohorts.map((c) => ({ value: c, label: c }))} style={{ minWidth: 180 }} />
        <Segmented value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'finished', label: 'Finished' }, { value: 'running', label: 'Running' }]} />
        <Flex gap={6} align="center">
          <Switch size="small" checked={flaggedOnly} onChange={setFlaggedOnly} id="flagged-only" />
          <label htmlFor="flagged-only"><Text>Flagged only{flagged ? ` (${flagged})` : ''}</Text></label>
        </Flex>
      </Flex>
      <Table
        size="small"
        rowKey="id"
        dataSource={rows}
        pagination={{ pageSize: 25, hideOnSinglePage: true, showTotal: (n) => `${n} sessions` }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={sessions.length ? 'No sessions match.' : 'No sessions yet.'} /> }}
        onRow={(r) => ({ onClick: () => setOpenId(r.id), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Student', dataIndex: 'student', sorter: (a, b) => a.student.localeCompare(b.student),
            render: (v, r) => <Flex vertical gap={0}><Text strong>{v}</Text><Text type="secondary" style={{ fontSize: 12 }}>{r.cohort ?? 'no cohort'}</Text></Flex>,
          },
          { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <Tag color={STATUS[v]?.color} style={{ margin: 0 }}>{STATUS[v]?.label ?? v}</Tag> },
          {
            title: 'Score', key: 'score', width: 110, align: 'right',
            sorter: (a, b) => (a.effectiveScore ?? -1) - (b.effectiveScore ?? -1),
            render: (_, r) => (r.overrideScore != null
              ? <Tooltip title={`Adjusted from ${r.score}/${r.maxScore}`}><Text>{scoreText(r.effectiveScore, r.maxScore)} <Text type="warning">✎</Text></Text></Tooltip>
              : scoreText(r.effectiveScore, r.maxScore)),
          },
          { title: 'Flags', dataIndex: 'flags', render: (v) => <FlagTags flags={v} definition={definition} /> },
          { title: 'Checks', dataIndex: 'runs', width: 80, align: 'right' },
          { title: 'Version', dataIndex: 'version', width: 80, align: 'right', render: (v) => `v${v}` },
          { title: 'Finished', dataIndex: 'endedAt', width: 170, sorter: (a, b) => (a.endedAt ?? '').localeCompare(b.endedAt ?? ''), defaultSortOrder: 'descend', render: (v, r) => <Text type="secondary">{fmt(v ?? r.createdAt)}</Text> },
        ]}
      />
      <SessionDrawer sessionId={openId} definition={definition} onClose={() => setOpenId(null)} />
    </Flex>
  );
}

function SessionDrawer({ sessionId, definition, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [, startLoad] = useTransition();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    startLoad(async () => {
      const res = await labSessionDetail(sessionId);
      if (!alive) return;
      if (res?.error) setError(res.error);
      else { setDetail(res); setError(null); }
    });
    return () => { alive = false; };
  }, [sessionId, version]);

  const shown = detail && detail.id === sessionId ? detail : null;
  return (
    <Drawer open={Boolean(sessionId)} onClose={onClose} size={860} destroyOnHidden title={shown ? `${shown.student.name} · session` : 'Session'}>
      {error && <Alert type="error" showIcon title={error} />}
      {!shown && !error && <Skeleton active paragraph={{ rows: 10 }} />}
      {shown && <SessionDetailView d={shown} definition={definition} onChanged={() => setVersion((v) => v + 1)} />}
    </Drawer>
  );
}

function SessionDetailView({ d, definition, onChanged }) {
  const finalRun = [...d.runs].reverse().find((r) => r.final && r.status === 'GRADED');
  return (
    <Flex vertical gap={16}>
      <Descriptions
        size="small"
        bordered
        column={2}
        items={[
          { key: 'st', label: 'Student', children: <>{d.student.name}<br /><Text type="secondary">{d.student.email}</Text></> },
          { key: 'co', label: 'Cohort', children: d.student.cohort ?? '—' },
          { key: 'status', label: 'Status', children: <><Tag color={STATUS[d.status]?.color}>{STATUS[d.status]?.label ?? d.status}</Tag>{d.note && <Text type="secondary">{d.note}</Text>}</> },
          { key: 'ver', label: 'Lab version', children: `v${d.version}` },
          { key: 'start', label: 'Started', children: fmt(d.startedAt ?? d.createdAt) },
          { key: 'end', label: 'Finished', children: fmt(d.endedAt) },
          { key: 'score', label: 'Score', children: d.override ? <>{scoreText(d.override.score, d.maxScore)} <Text type="secondary">(computed {scoreText(d.score, d.maxScore)})</Text></> : scoreText(d.score, d.maxScore) },
          { key: 'flags', label: 'Flags', children: d.flags.length ? <FlagTags flags={d.flags} definition={definition} /> : <Text type="secondary">none</Text> },
          { key: 'params', label: 'Their values', span: 2, children: <Flex gap={6} wrap>{Object.entries(d.params).map(([k, v]) => <Tag key={k}><Text code>{k}</Text> {String(v)}</Tag>)}<Tag>nonce {d.nonce}</Tag></Flex> },
          {
            key: 'machines', label: 'Machines', span: 2,
            children: d.machines.map((m) => (
              <div key={m.role}>
                <Text strong>{m.role}</Text>: {m.label} <Text type="secondary">({m.hostname}, {m.os}, agent {m.agentVersion})</Text>
                {m.baseline && <Text type="secondary"> · baseline: {m.baseline.files} files hashed{m.baseline.truncated ? ' (truncated)' : ''}{m.baseline.lockdown ? ' · SSH locked' : ''}</Text>}
              </div>
            )),
          },
        ]}
      />
      {d.flags.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title="Flags are signals to look into, not verdicts"
          description={d.flags.map((f) => <div key={f}><Text strong>{f}</Text>: {flagInfo(f, definition)}</div>)}
        />
      )}
      {d.runs.some((r) => r.status === 'GRADED') && <ReferenceActions d={d} />}
      {d.status === 'ENDED' && <OverrideForm d={d} onChanged={onChanged} />}
      <Tabs
        items={[
          { key: 'runs', label: `Check runs (${d.runs.length})`, children: <RunsList runs={d.runs} /> },
          { key: 'evidence', label: 'Evidence', children: finalRun || d.runs.length ? <EvidenceView runs={d.runs} /> : <Empty /> },
          { key: 'timeline', label: 'Timeline', children: <SessionTimeline d={d} /> },
        ]}
      />
    </Flex>
  );
}

/* Use this session as the lab version's reference evidence: how a lab uploaded
   without reference/good.evidence.json (a draft) gets one from a real machine. */
function ReferenceActions({ d }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState(null);
  const hasFinal = d.runs.some((r) => r.final && r.status === 'GRADED');

  const save = (kind) => start(async () => {
    const res = await saveLabReference(d.id, kind);
    if (res?.error) { message.error(res.error); return; }
    if (!res.ok) { setErrors(res.errors); return; }
    setErrors(null);
    message.success(kind === 'good'
      ? `Saved as version ${res.version}'s good reference (${res.score}/${res.maxScore})${res.activated ? '. The version is live: students can now run it.' : ''}`
      : `Saved as version ${res.version}'s broken reference`);
    router.refresh();
  });

  return (
    <Flex vertical gap={8}>
      <Flex gap={8} wrap align="center">
        <Text type="secondary"><SafetyCertificateOutlined /> Reference for v{d.version}{hasFinal ? '' : ' (from a practice check)'}:</Text>
        <Popconfirm
          title="Save as the good reference?"
          description={<>This session&rsquo;s evidence must score full marks on v{d.version}.<br />Use a machine built from your answer key.</>}
          okText="Save"
          onConfirm={() => save('good')}
        >
          <Button size="small" type="primary" ghost loading={pending}>Save as good reference</Button>
        </Popconfirm>
        <Popconfirm
          title="Save as the broken reference?"
          description={<>What passes and fails here becomes what an untouched<br />machine must get. Use a VM with nothing done.</>}
          okText="Save"
          onConfirm={() => save('broken')}
        >
          <Button size="small" loading={pending}>Save as broken reference</Button>
        </Popconfirm>
        <Button size="small" icon={<DownloadOutlined />} href={`/admin/labs/sessions/${d.id}/evidence`}>Download evidence</Button>
      </Flex>
      {errors && (
        <Alert
          type="error"
          showIcon
          closable={{ onClose: () => setErrors(null) }}
          title="Not saved: the gate didn't pass with this evidence"
          description={errors.map((e, i) => <div key={i}><Text code>{e.file}</Text> {e.message}</div>)}
        />
      )}
    </Flex>
  );
}

function OverrideForm({ d, onChanged }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [score, setScore] = useState(d.override?.score ?? d.score);
  const [reason, setReason] = useState(d.override?.reason ?? '');
  const [pending, start] = useTransition();
  const save = (value) => start(async () => {
    const res = await overrideLabScore(d.id, value, reason);
    if (res?.error) message.error(res.error);
    else { message.success(value == null ? 'Override removed' : 'Score adjusted'); onChanged(); router.refresh(); }
  });
  return (
    <Flex vertical gap={8} style={{ padding: 12, borderRadius: 8, background: 'var(--ath-color-fill-quaternary)' }}>
      <Text strong>Adjust the score</Text>
      {d.override && <Text type="secondary" style={{ fontSize: 13 }}>Adjusted by {d.override.by} on {fmt(d.override.at)}: “{d.override.reason}”</Text>}
      <Space wrap>
        <InputNumber min={0} max={d.maxScore ?? 100} value={score} onChange={setScore} addonAfter={`/ ${d.maxScore}`} />
        <Input placeholder="Reason (kept with the session)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: 340 }} />
        <Button type="primary" loading={pending} disabled={score == null || !reason.trim()} onClick={() => save(score)}>Save</Button>
        {d.override && <Button loading={pending} onClick={() => save(null)}>Remove override</Button>}
      </Space>
    </Flex>
  );
}

export function CheckLine({ c }) {
  const icon = c.skipped ? <MinusCircleOutlined /> : c.max === 0 ? (c.flagged ? <FlagFilled style={{ color: 'var(--ath-color-error)' }} /> : <MinusCircleOutlined />) : c.passed ? <CheckCircleFilled style={{ color: 'var(--ath-color-success)' }} /> : <CloseCircleFilled style={{ color: 'var(--ath-color-error)' }} />;
  return (
    <Flex vertical gap={2} style={{ padding: '6px 0', borderTop: '1px solid var(--ath-color-border-secondary)' }}>
      <Flex justify="space-between" gap={10}>
        <Flex gap={8} align="baseline">{icon}<Text>{c.title}</Text><Text type="secondary" style={{ fontSize: 12, fontFamily: 'var(--ath-font-family-code)' }}>{c.id}</Text>{c.visibility === 'instructor' && <Tag style={{ margin: 0 }}>instructor only</Tag>}</Flex>
        <Text type="secondary">{c.max ? `${c.points}/${c.max}` : c.flag ? (c.flagged ? `flag ${c.flag}` : 'no flag') : ''}</Text>
      </Flex>
      {c.assertions?.length > 1 && c.assertions.map((a, i) => (
        <Text key={i} style={{ fontSize: 12, paddingLeft: 22 }} type={a.passed ? 'secondary' : undefined}>{a.passed ? '✓' : '✗'} {a.label}{a.max ? ` (${a.points}/${a.max})` : ''}</Text>
      ))}
      {c.reason && <Text type="danger" style={{ fontSize: 12, paddingLeft: 22 }}>{c.reason}</Text>}
      {c.detail?.map((n, i) => <Text key={i} code style={{ fontSize: 11, marginLeft: 22, whiteSpace: 'pre-wrap' }}>{n}</Text>)}
    </Flex>
  );
}

function RunsList({ runs }) {
  if (!runs.length) return <Empty description="No checks were run." />;
  return (
    <Collapse
      size="small"
      defaultActiveKey={[runs[runs.length - 1].id]}
      items={[...runs].reverse().map((r) => ({
        key: r.id,
        label: (
          <Flex justify="space-between" style={{ width: '100%' }}>
            <span>{r.final ? 'Final check' : 'Practice check'} · {fmt(r.requestedAt)}{r.regradedAt ? ' · re-graded' : ''}</span>
            <Text type="secondary">{r.status === 'GRADED' ? scoreText(r.score, r.maxScore) : r.status.toLowerCase()}</Text>
          </Flex>
        ),
        children: r.result ? (
          <Flex vertical>
            {r.result.checks.map((c) => <CheckLine key={c.id} c={c} />)}
            <Text type="secondary" style={{ fontSize: 11, marginTop: 6 }}>grader {r.graderRev}</Text>
          </Flex>
        ) : <Text type="secondary">Not graded.</Text>,
      }))}
    />
  );
}

export function ItemValue({ item }) {
  if (!item.ok) return <Text type="danger">{item.error}: {item.message}</Text>;
  const text = (k) => (typeof item[k] === 'string' && item[k] ? (
    <div>
      <Text type="secondary" style={{ fontSize: 12 }}>{k}</Text>
      <pre style={{ margin: '2px 0 8px', maxHeight: 260, overflow: 'auto', fontSize: 11.5, background: 'var(--ath-color-fill-quaternary)', padding: 8, borderRadius: 6, whiteSpace: 'pre-wrap' }}>{item[k]}</pre>
    </div>
  ) : null);
  const rest = Object.fromEntries(Object.entries(item).filter(([k]) => !['stdout', 'stderr', 'content', 'ok'].includes(k)));
  return (
    <>
      {text('stdout')}{text('stderr')}{text('content')}
      <pre style={{ margin: 0, fontSize: 11.5, whiteSpace: 'pre-wrap' }}>{JSON.stringify(rest, null, 1)}</pre>
    </>
  );
}

function EvidenceView({ runs }) {
  const withEvidence = [...runs].reverse().filter((r) => r.evidence);
  const [runId, setRunId] = useState(withEvidence[0]?.id);
  const run = withEvidence.find((r) => r.id === runId);
  if (!run) return <Empty description="No evidence collected." />;
  const roles = Object.entries(run.evidence.roles ?? {});
  return (
    <Flex vertical gap={10}>
      <Select value={runId} onChange={setRunId} style={{ maxWidth: 360 }} options={withEvidence.map((r) => ({ value: r.id, label: `${r.final ? 'Final' : 'Practice'} · ${fmt(r.requestedAt)}` }))} />
      {roles.map(([role, ev]) => (
        <Flex key={role} vertical gap={6}>
          <Text strong>{role} {ev.machine?.hostname && <Text type="secondary">({ev.machine.hostname})</Text>}</Text>
          {ev.lockdown && (
            <Alert
              type={ev.lockdown.logins?.length || ev.lockdown.sshSessions ? 'error' : 'info'}
              showIcon
              title="Lockdown report"
              description={
                <>
                  <div>SSH units: {(ev.lockdown.units ?? []).map((u) => `${u.unit} ${u.loadState}/${u.activeState}`).join(', ') || 'none installed'}</div>
                  <div>Live SSH sessions: {ev.lockdown.sshSessions ?? 0} · undo record present: {ev.lockdown.journal ? 'yes' : 'no'}</div>
                  {ev.lockdown.logins?.length > 0 && <pre style={{ margin: '6px 0 0', fontSize: 11, whiteSpace: 'pre-wrap' }}>{ev.lockdown.logins.join('\n')}</pre>}
                </>
              }
            />
          )}
          <Collapse
            size="small"
            items={Object.entries(ev.items ?? {}).map(([name, item]) => ({
              key: name,
              label: <Flex gap={8} align="center"><Badge status={item.ok ? 'success' : 'error'} /><Text code>{name}</Text>{item.exit_code !== undefined && <Text type="secondary">exit {item.exit_code}</Text>}{item.truncated && <Tag style={{ margin: 0 }}>truncated</Tag>}</Flex>,
              children: <ItemValue item={item} />,
            }))}
          />
        </Flex>
      ))}
    </Flex>
  );
}

const TASK_COLOR = { DONE: 'green', FAILED: 'red', EXPIRED: 'gray', QUEUED: 'blue', DELIVERED: 'blue' };

function SessionTimeline({ d }) {
  const events = [
    ...d.tasks.map((t) => ({ at: t.createdAt, color: TASK_COLOR[t.status], text: <>{t.kind.toLowerCase()} on <Text strong>{t.role}</Text> → {t.status.toLowerCase()}{t.error ? <Text type="danger"> · {t.error}</Text> : ''}</> })),
    ...d.audit.map((a) => ({ at: a.at, color: a.type === 'FLAG' ? 'red' : 'gray', text: <><Tag style={{ margin: 0 }}>{a.type}</Tag> <Text type="secondary" style={{ fontSize: 12 }}>{JSON.stringify(a.detail)}</Text></> })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <Timeline
      items={events.map((e, i) => ({
        key: i,
        color: e.color,
        children: <Flex vertical gap={0}><Text type="secondary" style={{ fontSize: 12 }}>{fmt(e.at)}</Text><Paragraph style={{ margin: 0 }}>{e.text}</Paragraph></Flex>,
      }))}
    />
  );
}

export default LabSessions;
