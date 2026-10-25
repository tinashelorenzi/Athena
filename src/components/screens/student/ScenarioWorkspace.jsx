'use client';
import React, { useState, useMemo, useEffect, useRef, useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Layout, Menu, Button, Tag, Badge, Card, Table, Typography, Flex, Space, Segmented, Input, Alert, Empty, Spin,
  Drawer, FloatButton, Tooltip, Popconfirm, Progress, Tabs, Tree, Descriptions, theme,
} from 'antd';
import {
  ArrowLeftOutlined, ReadOutlined, FileTextOutlined, AlertOutlined, FileSearchOutlined, CodeOutlined, DesktopOutlined,
  PaperClipOutlined, CaretRightOutlined, PauseOutlined, FlagOutlined, ClockCircleOutlined, ThunderboltOutlined,
  CheckCircleFilled, CheckOutlined, SendOutlined, AimOutlined, DownloadOutlined, FileZipOutlined, UploadOutlined,
  DeleteOutlined, LockOutlined, TrophyOutlined, EditOutlined, AuditOutlined, CloseOutlined, FileDoneOutlined,
} from '@ant-design/icons';
import { Markdown } from '@/components/Markdown';
import { TechniqueTags } from '@/components/attack/TechniqueTags';
import { RichText } from '@/components/RichText';
import { StudentTopBar } from './StudentTopBar';
import { GuideView } from './GuideView';
import { AlertCaseDialog, VERDICTS } from './AlertCaseDialog';
import { LogsPanel, PanelHeader, NotRunningCard } from './LogsPanel';
import { feedAtClient } from './previewFeed';

// alasql (used by OSQueryPanel) only bundles for the browser, so load it client-only.
const OSQueryPanel = dynamic(() => import('./OSQueryPanel').then((m) => m.OSQueryPanel), { ssr: false });
import { submitScenario } from '@/app/actions/submissions';
import { checkFlag } from '@/app/actions/flags';
import { startRun, pauseRun, resumeRun, completeRun } from '@/app/actions/runs';
import { Tour } from '@/components/Tour';

const { Text, Paragraph } = Typography;

const SCENARIO_TOUR = [
  { selector: '[data-tour="run"]', title: 'Start the scenario', body: 'Press Run to start the clock — alerts and logs stream in over time, just like a real shift. Dojos can be paused; assessments run to the end. Your elapsed time shows here.' },
  { selector: '[data-tour="panel-guide"]', title: 'Guide', body: 'A step-by-step teaching walkthrough with checkpoints you solve as you go. (Dojo scenarios.)' },
  { selector: '[data-tour="panel-brief"]', title: 'Briefing', body: 'The incident brief and your objectives — start here to understand what you’re investigating.' },
  { selector: '[data-tour="panel-alerts"]', title: 'Alerts', body: 'The alert queue. Triage each one: set a verdict (true / false positive), add notes, and capture IOCs.' },
  { selector: '[data-tour="panel-logs"]', title: 'Logs', body: 'Search raw event logs with KQL and a live timeline, like Kibana Discover. Your main hunting ground.' },
  { selector: '[data-tour="panel-osquery"]', title: 'OSQuery', body: 'Run real SQL against endpoint tables (processes, connections, and more) to answer precise questions.' },
  { selector: '[data-tour="panel-endpoints"]', title: 'EDR', body: 'Endpoint detection & response: process trees, network connections, and browser / shell history.' },
  { selector: '[data-tour="panel-artifacts"]', title: 'Artifacts', body: 'Download evidence files attached to the scenario for deeper analysis.' },
  { selector: '[data-tour="fab-answers"]', title: 'Answers & submit', body: 'Open from any panel. In a Dojo you check flags for instant feedback; in an Assessment you write and submit your report for grading.' },
  { selector: '[data-tour="fab-guide"]', title: 'Guide, anywhere', body: 'Pop the guide open from any panel without losing your place.' },
];

// The Guide and Answers surfaces are always-available FABs (bottom right), so a
// student can reference them from any investigation panel.
const BASE_PANELS = [
  { id: 'brief', label: 'Brief', icon: <FileTextOutlined /> },
  { id: 'alerts', label: 'Alerts', icon: <AlertOutlined /> },
  { id: 'logs', label: 'Logs', icon: <FileSearchOutlined /> },
  { id: 'osquery', label: 'OSQuery', icon: <CodeOutlined /> },
  { id: 'endpoints', label: 'EDR', icon: <DesktopOutlined /> },
  { id: 'artifacts', label: 'Artifacts', icon: <PaperClipOutlined /> },
];
const GUIDE_PANEL = { id: 'guide', label: 'Guide', icon: <ReadOutlined /> };

const TYPE_TAG = { DOJO: { color: 'cyan', label: 'Dojo' }, ASSESSMENT: { color: 'purple', label: 'Assessment' } };
const VERDICT_META = Object.fromEntries(VERDICTS.map((v) => [v.id, v]));

// Wall clock for the preview-mode run timer (event handlers only).
const wallNow = () => Date.now();
const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const fmt = (v) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export function ScenarioWorkspace({ user, scenario, submission, initialRun, solvedIds, solvedFlagIds, initialCases, preview = false }) {
  const router = useRouter();
  const { token } = theme.useToken();
  const PANELS = scenario.hasGuide ? [GUIDE_PANEL, ...BASE_PANELS] : BASE_PANELS;
  const [panel, setPanel] = useState(scenario.hasGuide ? 'guide' : 'brief');
  const [run, setRun] = useState(initialRun);
  const [err, setErr] = useState(null);
  const [busy, startTransition] = useTransition();
  const [cases, setCases] = useState(initialCases || {});
  const [caseAlert, setCaseAlert] = useState(null);
  const [drawer, setDrawer] = useState(null); // 'guide' | 'answers' | null
  // Lift solved state so Answers / Guide panels keep progress when closed or switched.
  const [guideSolvedIds, setGuideSolvedIds] = useState(() => solvedIds || []);
  const [flagSolvedIds, setFlagSolvedIds] = useState(() => solvedFlagIds || []);
  const markGuideSolved = (id) => setGuideSolvedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const markFlagSolved = (id) => setFlagSolvedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const isDojo = scenario.type === 'DOJO';

  // Preview mode: an ephemeral, client-side clock (no server actions, no storage).
  const startRef = useRef(0);
  const accumRef = useRef(0);

  const canPause = scenario.type === 'DOJO' && !scenario.realtime;

  const hasRun = run.status !== 'NONE';
  // Timestamp (ms) of the last `feed` message actually received over the socket.
  // Feed *liveness* — not merely "socket open" — drives the poll fallback, so a
  // half-connected socket (opened, but the server returns `error` or stalls and
  // never pushes) can't silently freeze the feed.
  const lastFeedRef = useRef(0);

  // Live feed over WebSocket (real-time push). The poll effect below covers any
  // case where the socket connects but no feed arrives (nginx `/ws` not wired,
  // non-cohort subscriber, transient server error).
  useEffect(() => {
    if (preview || !hasRun || typeof window === 'undefined') return;
    let socket;
    let closed = false;
    let retry;
    const connect = () => {
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${proto}//${window.location.host}/ws`);
      } catch { return; }
      socket.onopen = () => { socket.send(JSON.stringify({ type: 'subscribe', scenarioId: scenario.id })); };
      socket.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.type === 'feed') { lastFeedRef.current = Date.now(); setRun((r) => ({ ...r, ...d })); }
        } catch { /* ignore */ }
      };
      socket.onclose = () => { if (!closed) retry = setTimeout(connect, 5000); };
      socket.onerror = () => { try { socket.close(); } catch { /* ignore */ } };
    };
    connect();
    return () => { closed = true; clearTimeout(retry); try { socket?.close(); } catch { /* ignore */ } };
  }, [scenario.id, hasRun, preview]);

  // Poll fallback while running. Skips a tick only when the socket delivered a
  // feed very recently — so if the socket is dead/silent, polling keeps the feed
  // flowing without waiting on a refresh.
  useEffect(() => {
    if (preview || run.status !== 'RUNNING') return;
    let active = true;
    const poll = async () => {
      if (Date.now() - lastFeedRef.current < 3500) return; // socket is feeding; let it
      try {
        const res = await fetch(`/api/runs/${scenario.id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setRun((r) => ({ ...r, ...data }));
      } catch { /* transient */ }
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => { active = false; clearInterval(id); };
  }, [run.status, scenario.id, preview]);

  // Smooth local clock between polls.
  useEffect(() => {
    if (preview || run.status !== 'RUNNING') return;
    const id = setInterval(() => setRun((r) => ({ ...r, elapsed: (r.elapsed ?? 0) + 1 })), 1000);
    return () => clearInterval(id);
  }, [preview, run.status]);

  // Preview clock: advance elapsed + recompute the fired feed entirely client-side.
  useEffect(() => {
    if (!preview || run.status !== 'RUNNING') return;
    const id = setInterval(() => {
      const e = Math.floor(accumRef.current + (Date.now() - startRef.current) / 1000);
      setRun((r) => ({ ...r, elapsed: e, ...feedAtClient(scenario.rawAlerts, scenario.rawLogs, e) }));
    }, 1000);
    return () => clearInterval(id);
  }, [preview, run.status, scenario.rawAlerts, scenario.rawLogs]);

  // Run controls — server actions normally; local clock in preview.
  const doRun = () => {
    if (!preview) return act(startRun);
    accumRef.current = 0; startRef.current = wallNow();
    setRun((r) => ({ ...r, status: 'RUNNING', elapsed: 0, ...feedAtClient(scenario.rawAlerts, scenario.rawLogs, 0) }));
  };
  const doPause = () => {
    if (!preview) return act(pauseRun);
    const e = Math.floor(accumRef.current + (wallNow() - startRef.current) / 1000);
    accumRef.current = e; setRun((r) => ({ ...r, status: 'PAUSED', elapsed: e }));
  };
  const doResume = () => {
    if (!preview) return act(resumeRun);
    startRef.current = wallNow(); setRun((r) => ({ ...r, status: 'RUNNING' }));
  };
  const doComplete = () => {
    if (!preview) return act(completeRun);
    const e = Math.floor(accumRef.current + (run.status === 'RUNNING' ? (wallNow() - startRef.current) / 1000 : 0));
    accumRef.current = e; setRun((r) => ({ ...r, status: 'COMPLETED', elapsed: e }));
  };

  const act = (fn) => {
    setErr(null);
    startTransition(async () => {
      const res = await fn(scenario.id);
      if (res?.error) { setErr(res.error); return; }
      setRun((r) => ({ ...r, status: res.status, elapsed: res.elapsed ?? r.elapsed }));
      try {
        const data = await (await fetch(`/api/runs/${scenario.id}`, { cache: 'no-store' })).json();
        setRun((r) => ({ ...r, ...data }));
      } catch { /* ignore */ }
    });
  };

  // Alert queue rows (stable ids) + triage progress.
  const alerts = useMemo(() => (run.alerts || []).map((a, i) => ({ ...a, id: a.id ?? `a${i}` })), [run.alerts]);
  const triaged = alerts.filter((a) => cases[a.id]?.verdict).length;
  const untriaged = alerts.length - triaged;

  const typeTag = TYPE_TAG[scenario.type] || TYPE_TAG.DOJO;
  const left = (
    <Flex align="center" gap={10} style={{ minWidth: 0 }}>
      <Tooltip title={preview ? 'Back to scenario' : 'Back to dashboard'}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.push(preview ? `/admin/scenarios/${scenario.id}` : '/learn')} />
      </Tooltip>
      <Text strong ellipsis style={{ fontSize: 15, maxWidth: 360 }}>{scenario.title}</Text>
      <Tag color={typeTag.color} style={{ marginInlineEnd: 0 }}>{typeTag.label}</Tag>
      {preview && <Tag color="gold">Preview</Tag>}
    </Flex>
  );

  const menuItems = PANELS.map((p) => ({
    key: p.id,
    icon: p.icon,
    'data-tour': `panel-${p.id}`,
    label: p.id === 'alerts' && alerts.length > 0 ? (
      <Flex align="center" justify="space-between" gap={8}>
        <span>{p.label}</span>
        <Tooltip title={untriaged ? `${untriaged} untriaged of ${alerts.length}` : `All ${alerts.length} triaged`} placement="right">
          <Badge count={untriaged || alerts.length} color={untriaged ? token.colorError : token.colorTextQuaternary} size="small" />
        </Tooltip>
      </Flex>
    ) : p.label,
  }));

  const guide = (
    <GuideView scenarioId={scenario.id} markdown={scenario.guide} prompts={scenario.guidePrompts} solvedIds={guideSolvedIds} onPromptSolved={markGuideSolved} preview={preview} />
  );
  const flagsTotal = scenario.flags?.length || 0;

  return (
    <Layout style={{ height: '100vh' }}>
      <StudentTopBar user={user} left={left} />

      {/* run control bar */}
      <Flex
        data-tour="run"
        align="center"
        gap={12}
        wrap
        style={{ minHeight: 48, flex: 'none', padding: '6px 20px', background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <RunControls run={run} canPause={canPause} realtime={scenario.realtime} busy={busy} onRun={doRun} onPause={doPause} onResume={doResume} onComplete={doComplete} />
        {scenario.realtime && <Tag icon={<ThunderboltOutlined />} color="red">Real-time · runs continuously</Tag>}
        {err && <Alert type="error" showIcon title={err} style={{ padding: '2px 10px' }} closable={{ onClose: () => setErr(null) }} />}
        <div style={{ flex: 1 }} />
        {hasRun && alerts.length > 0 && (
          <Tooltip title="Alerts with a verdict">
            <Flex align="center" gap={8} style={{ cursor: 'pointer' }} onClick={() => setPanel('alerts')}>
              <Text type="secondary" style={{ fontSize: 12 }}>Triaged</Text>
              <Progress percent={Math.round((triaged / alerts.length) * 100)} size={[120, 6]} showInfo={false} />
              <Text style={{ fontSize: 12, fontFamily: token.fontFamilyCode }}>{triaged}/{alerts.length}</Text>
            </Flex>
          </Tooltip>
        )}
        {isDojo && flagsTotal > 0 && (
          <Tooltip title="Flags solved">
            <Flex align="center" gap={8} style={{ cursor: 'pointer' }} onClick={() => setDrawer('answers')}>
              <FlagOutlined style={{ color: token.colorTextTertiary }} />
              <Text style={{ fontSize: 12, fontFamily: token.fontFamilyCode }}>{flagSolvedIds.length}/{flagsTotal}</Text>
            </Flex>
          </Tooltip>
        )}
      </Flex>

      <Layout hasSider style={{ flex: 1, minHeight: 0 }}>
        <Layout.Sider width={196} style={{ borderRight: `1px solid ${token.colorBorderSecondary}`, overflow: 'auto' }}>
          <Menu
            mode="inline"
            selectedKeys={[panel]}
            onClick={({ key }) => setPanel(key)}
            items={[{ type: 'group', key: 'g', label: 'Investigate', children: menuItems }]}
            style={{ borderInlineEnd: 0, padding: '8px 4px' }}
          />
        </Layout.Sider>

        <Layout.Content style={{ overflow: 'auto', minWidth: 0 }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', padding: 24 }}>
            {panel === 'guide' && (
              <div>
                <PanelHeader icon={<ReadOutlined />} title="Guide" sub="Work through the guide and solve the checkpoints as you go." />
                <Card>{guide}</Card>
              </div>
            )}
            {panel === 'brief' && <BriefPanel scenario={scenario} />}
            {panel === 'alerts' && <AlertsPanel run={run} alerts={alerts} cases={cases} onOpenCase={setCaseAlert} />}
            {panel === 'logs' && <LogsPanel run={run} />}
            {panel === 'osquery' && <OSQueryPanel endpoints={scenario.endpoints} />}
            {panel === 'endpoints' && <EndpointsPanel endpoints={scenario.endpoints} />}
            {panel === 'artifacts' && <ArtifactsPanel endpoints={scenario.endpoints} />}
          </div>
        </Layout.Content>
      </Layout>

      {/* Floating access to the guide + answers from any panel */}
      <FloatButton.Group shape="square" style={{ insetInlineEnd: 24, insetBlockEnd: 24 }}>
        {scenario.hasGuide && (
          <FloatButton
            data-tour="fab-guide"
            icon={<ReadOutlined />}
            content="Guide"
            tooltip={{ title: 'Open the guide', placement: 'left' }}
            type={drawer === 'guide' ? 'primary' : 'default'}
            onClick={() => setDrawer((d) => (d === 'guide' ? null : 'guide'))}
          />
        )}
        <FloatButton
          data-tour="fab-answers"
          icon={isDojo ? <FlagOutlined /> : <SendOutlined />}
          content={isDojo ? 'Answers' : 'Submit'}
          tooltip={{ title: isDojo ? 'Check your flag answers' : 'Submit your deliverables', placement: 'left' }}
          type="primary"
          badge={isDojo && flagsTotal ? { count: `${flagSolvedIds.length}/${flagsTotal}`, color: flagSolvedIds.length === flagsTotal ? token.colorSuccess : token.colorTextSecondary } : undefined}
          onClick={() => setDrawer((d) => (d === 'answers' ? null : 'answers'))}
        />
      </FloatButton.Group>

      {scenario.hasGuide && (
        <Drawer
          open={drawer === 'guide'}
          onClose={() => setDrawer(null)}
          size={620}
          destroyOnHidden
          title={<Space><ReadOutlined />Scenario guide</Space>}
        >
          {guide}
        </Drawer>
      )}
      <Drawer
        open={drawer === 'answers'}
        onClose={() => setDrawer(null)}
        size={500}
        destroyOnHidden
        title={<Space>{isDojo ? <FlagOutlined /> : <SendOutlined />}{isDojo ? 'Answers' : 'Submit deliverables'}</Space>}
      >
        {isDojo
          ? <FlagChecklist scenario={scenario} scenarioId={scenario.id} solvedFlagIds={flagSolvedIds} onFlagSolved={markFlagSolved} preview={preview} />
          : <SubmitForm scenario={scenario} submission={submission} preview={preview} />}
      </Drawer>

      <AlertCaseDialog
        key={caseAlert ? caseAlert.id : 'none'}
        alert={caseAlert}
        caseData={caseAlert ? cases[caseAlert.id] : null}
        scenarioId={scenario.id}
        preview={preview}
        onClose={() => setCaseAlert(null)}
        onError={setErr}
        onSaved={(alertId, data) => setCases((c) => ({ ...c, [alertId]: data }))}
      />

      {!preview && <Tour steps={SCENARIO_TOUR} storageKey="athena.tour.scenario.v1" />}
    </Layout>
  );
}

function RunControls({ run, canPause, realtime, busy, onRun, onPause, onResume, onComplete }) {
  const { token } = theme.useToken();
  const status = run.status;
  const noPauseNote = realtime ? 'Real-time · no pausing' : 'Assessment · runs to the end';
  const finish = (
    <Popconfirm title="Finish this scenario?" description="The clock stops and no further alerts will fire." okText="Finish" onConfirm={onComplete}>
      <Button size="small" icon={<FlagOutlined />} loading={busy}>Finish</Button>
    </Popconfirm>
  );
  return (
    <Flex align="center" gap={12}>
      {status === 'NONE' && <Button type="primary" icon={<CaretRightOutlined />} loading={busy} onClick={onRun}>Run scenario</Button>}
      {status === 'RUNNING' && (
        <>
          <Badge status="processing" text={<Text strong>Running</Text>} />
          {canPause
            ? <Button size="small" icon={<PauseOutlined />} loading={busy} onClick={onPause}>Pause</Button>
            : <Text type="secondary" style={{ fontSize: 12 }}>{noPauseNote}</Text>}
          {finish}
        </>
      )}
      {status === 'PAUSED' && (
        <>
          <Badge status="warning" text={<Text strong>Paused</Text>} />
          <Button type="primary" size="small" icon={<CaretRightOutlined />} loading={busy} onClick={onResume}>Resume</Button>
          {finish}
        </>
      )}
      {status === 'COMPLETED' && <Badge status="success" text={<Text strong>Completed</Text>} />}
      {status !== 'NONE' && (
        <Tag icon={<ClockCircleOutlined />} style={{ fontFamily: token.fontFamilyCode, fontSize: 13, padding: '2px 8px', marginInlineEnd: 0 }}>
          T+{fmtClock(run.elapsed ?? 0)}{status === 'COMPLETED' ? ' · final' : ''}
        </Tag>
      )}
    </Flex>
  );
}

function BriefPanel({ scenario }) {
  const { token } = theme.useToken();
  return (
    <Flex vertical gap={16}>
      <PanelHeader icon={<FileTextOutlined />} title="Briefing" sub="What happened, and what you need to find out." />
      <Card>{scenario.brief ? <Markdown>{scenario.brief}</Markdown> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No briefing provided." />}</Card>
      {scenario.techniques?.length > 0 && (
        <Card size="small" title={<Space><AimOutlined />MITRE ATT&amp;CK techniques</Space>}>
          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 10 }}>
            The adversary behaviour this scenario covers. Open a technique to read how it is detected and mitigated.
          </Paragraph>
          <TechniqueTags ids={scenario.techniques} />
        </Card>
      )}
      {scenario.objectives?.length > 0 && (
        <Card title={<Space><AimOutlined />Objectives</Space>} styles={{ body: { paddingBlock: 4 } }}>
          {scenario.objectives.map((o, i) => (
            <Flex key={o.id || i} gap={12} align="flex-start" style={{ padding: '10px 0', borderTop: i ? `1px solid ${token.colorBorderSecondary}` : 'none' }}>
              <Tag color="blue" style={{ marginInlineEnd: 0, minWidth: 26, textAlign: 'center' }}>{i + 1}</Tag>
              <Text>{o.text}</Text>
            </Flex>
          ))}
        </Card>
      )}
    </Flex>
  );
}

/* The alert queue: filterable table; click a row (or Triage) to open its case. */
function AlertsPanel({ run, alerts, cases, onOpenCase }) {
  const { token } = theme.useToken();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const mono = { fontFamily: token.fontFamilyCode, fontSize: 12 };

  const counts = useMemo(() => {
    const c = { all: alerts.length, open: 0, triaged: 0, closed: 0 };
    for (const a of alerts) {
      const cs = cases?.[a.id];
      if (!cs?.verdict) c.open += 1; else c.triaged += 1;
      if (cs?.status === 'CLOSED') c.closed += 1;
    }
    return c;
  }, [alerts, cases]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return alerts
      .filter((a) => {
        const cs = cases?.[a.id];
        if (filter === 'open') return !cs?.verdict;
        if (filter === 'triaged') return Boolean(cs?.verdict);
        if (filter === 'closed') return cs?.status === 'CLOSED';
        return true;
      })
      .filter((a) => !s || JSON.stringify(a).toLowerCase().includes(s));
  }, [alerts, cases, filter, q]);

  const header = (
    <PanelHeader
      icon={<AlertOutlined />}
      title="Alert queue"
      sub={run.status === 'NONE' ? 'Detections fire here as the scenario plays out.' : `${alerts.length} fired${run.status === 'PAUSED' ? ' · paused' : ''}`}
    />
  );
  if (run.status === 'NONE') return <div>{header}<NotRunningCard label="alert" /></div>;

  const columns = [
    { title: 'Fired', dataIndex: 'seek', key: 'seek', width: 80, sorter: (a, b) => (a.seek ?? 0) - (b.seek ?? 0), render: (v) => <Text type="secondary" style={mono}>T+{v ?? 0}s</Text> },
    {
      title: 'Alert', dataIndex: 'title', key: 'title',
      render: (v, r) => (
        <Flex vertical gap={2}>
          <Text strong>{v || r.id}</Text>
          <Text type="secondary" style={{ ...mono, fontSize: 11 }}>{r.id}</Text>
        </Flex>
      ),
    },
    { title: 'Host', dataIndex: 'host', key: 'host', width: 130, render: (v) => <Text style={mono}>{v || '—'}</Text> },
    {
      title: 'Source → Dest', key: 'flow', width: 220,
      render: (_v, r) => <Text style={mono}>{r.source || '—'} <Text type="secondary">→</Text> {r.destination || '—'}</Text>,
    },
    { title: 'Rule', dataIndex: 'rule', key: 'rule', width: 120, render: (v) => (v ? <Tag color="geekblue" style={mono}>{v}</Tag> : <Text type="secondary">—</Text>) },
    { title: 'Events', dataIndex: 'count', key: 'count', width: 76, align: 'right', render: (v) => <Text style={mono}>{v ?? '—'}</Text> },
    {
      title: 'Case', key: 'case', width: 190, align: 'right',
      render: (_v, row) => {
        const c = cases?.[row.id];
        const vm = c?.verdict ? VERDICT_META[c.verdict] : null;
        return (
          <Space size={6} onClick={(e) => e.stopPropagation()}>
            {vm ? <Tag color={vm.color} style={{ marginInlineEnd: 0 }}>{vm.short}</Tag> : <Tag color="error" variant="outlined" style={{ marginInlineEnd: 0 }}>New</Tag>}
            {c?.status === 'CLOSED' && <Tooltip title="Case closed"><CheckCircleFilled style={{ color: token.colorSuccess }} /></Tooltip>}
            <Button size="small" type={c ? 'default' : 'primary'} icon={c ? <EditOutlined /> : <AuditOutlined />} onClick={() => onOpenCase?.(row)}>
              {c ? 'Edit' : 'Triage'}
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      {header}
      {alerts.length === 0 ? (
        <Card>
          <Flex align="center" gap={10}>
            <Spin size="small" spinning={run.status === 'RUNNING'} />
            <Text type="secondary">{run.status === 'PAUSED' ? 'Paused — resume to continue the feed.' : 'Monitoring… alerts will appear as they fire.'}</Text>
          </Flex>
        </Card>
      ) : (
        <Flex vertical gap={12}>
          {counts.open > 0 && (
            <Alert
              type="info"
              showIcon
              title={`${counts.open} alert${counts.open === 1 ? '' : 's'} waiting for triage`}
              description="Open an alert to investigate it: pivot into Logs, EDR and OSQuery, then record a verdict, your notes and any IoCs — and close the case."
            />
          )}
          <Flex gap={12} wrap align="center" justify="space-between">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `All (${counts.all})` },
                { value: 'open', label: `Untriaged (${counts.open})` },
                { value: 'triaged', label: `Triaged (${counts.triaged})` },
                { value: 'closed', label: `Closed (${counts.closed})` },
              ]}
            />
            <Input.Search allowClear placeholder="Filter alerts…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          </Flex>
          <Card styles={{ body: { padding: 0 } }}>
            <Table
              size="middle"
              rowKey="id"
              columns={columns}
              dataSource={rows}
              pagination={false}
              scroll={{ x: 900 }}
              onRow={(row) => ({ onClick: () => onOpenCase?.(row), style: { cursor: 'pointer' } })}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No alerts match this filter." /> }}
            />
          </Card>
        </Flex>
      )}
    </div>
  );
}

/* Process list → antd Tree data (stable keys from the path). */
function toTreeData(nodes, mono, path = 'p') {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((p, i) => {
    const key = `${path}-${i}`;
    return {
      key,
      title: (
        <span style={mono}>
          <Text strong style={mono}>{p.name}</Text>{' '}
          <Text type="secondary" style={{ ...mono, fontSize: 11 }}>pid {p.pid}{p.user ? ` · ${p.user}` : ''}</Text>
          {p.cmd && <> <Text type="secondary" style={{ ...mono, fontSize: 11, wordBreak: 'break-all' }}>{p.cmd}</Text></>}
        </span>
      ),
      children: Array.isArray(p.children) && p.children.length > 0 ? toTreeData(p.children, mono, key) : undefined,
    };
  });
}

function DataTable({ rows }) {
  const { token } = theme.useToken();
  if (!Array.isArray(rows) || rows.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No rows." />;
  const mono = { fontFamily: token.fontFamilyCode, fontSize: 12, whiteSpace: 'nowrap' };
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r || {})))];
  return (
    <Table
      size="small"
      rowKey={(_r, i) => i}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 'max-content' }}
      columns={cols.map((c) => ({ title: c, dataIndex: c, key: c, render: (v) => <Text style={mono}>{fmt(v)}</Text> }))}
    />
  );
}

function EndpointsPanel({ endpoints }) {
  const { token } = theme.useToken();
  const [host, setHost] = useState(endpoints[0]?.id ?? null);
  const ep = endpoints.find((e) => e.id === host) || endpoints[0];
  const mono = { fontFamily: token.fontFamilyCode, fontSize: 12.5 };
  const header = <PanelHeader icon={<DesktopOutlined />} title="EDR" sub="Endpoint detection & response telemetry" />;
  if (endpoints.length === 0) return <div>{header}<Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No endpoint data in this scenario." /></Card></div>;

  const edr = ep.edr;
  const has = (k) => Array.isArray(edr?.[k]) && edr[k].length > 0;
  const tabs = [
    has('processes') && {
      key: 'processes', label: 'Process tree',
      children: <Tree showLine blockNode selectable={false} defaultExpandAll treeData={toTreeData(edr.processes, mono)} />,
    },
    has('connections') && { key: 'connections', label: `Network (${edr.connections.length})`, children: <DataTable rows={edr.connections} /> },
    has('browserHistory') && { key: 'browser', label: `Browser history (${edr.browserHistory.length})`, children: <DataTable rows={edr.browserHistory} /> },
    has('shellHistory') && { key: 'shell', label: `Shell history (${edr.shellHistory.length})`, children: <DataTable rows={edr.shellHistory} /> },
  ].filter(Boolean);

  return (
    <Flex vertical gap={12}>
      {header}
      <Segmented
        value={ep.id}
        onChange={setHost}
        options={endpoints.map((e) => ({ value: e.id, label: <span style={mono}>{e.hostname}</span>, icon: <DesktopOutlined /> }))}
        style={{ alignSelf: 'flex-start' }}
      />
      <Card title={<Space><DesktopOutlined /><span>EDR · <span style={mono}>{ep.hostname}</span></span></Space>}>
        {edr && tabs.length > 0
          ? <Tabs key={ep.id} items={tabs} />
          : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No EDR data for this host. Try the OSQuery tab." />}
      </Card>
    </Flex>
  );
}

function ArtifactsPanel({ endpoints }) {
  const { token } = theme.useToken();
  const withArtifacts = endpoints.filter((e) => e.hasArtifact);
  return (
    <div>
      <PanelHeader icon={<PaperClipOutlined />} title="Artifacts" sub="Downloadable evidence per host" />
      <Card styles={{ body: { paddingBlock: withArtifacts.length ? 4 : undefined } }}>
        {withArtifacts.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No evidence artifacts in this scenario." />
        ) : (
          withArtifacts.map((e, i) => (
            <Flex key={e.id} align="center" gap={14} style={{ padding: '12px 0', borderTop: i ? `1px solid ${token.colorBorderSecondary}` : 'none' }}>
              <Flex align="center" justify="center" style={{ width: 40, height: 40, flex: 'none', borderRadius: token.borderRadius, background: token.colorFillTertiary, fontSize: 18, color: token.colorTextSecondary }}><FileZipOutlined /></Flex>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong style={{ fontFamily: token.fontFamilyCode }}>{e.hostname}</Text>
                <div><Text type="secondary" style={{ fontSize: 12.5 }}>{e.artifactName || 'artifact.zip'}{e.artifactSize ? ` · ${(e.artifactSize / 1024).toFixed(0)} KB` : ''}</Text></div>
              </div>
              <Button icon={<DownloadOutlined />} href={`/api/artifacts/${e.id}`}>Download</Button>
            </Flex>
          ))
        )}
      </Card>
    </div>
  );
}

function SubmitForm({ scenario, submission, preview }) {
  const { token } = theme.useToken();
  const [state, action, saving] = useActionState(submitScenario.bind(null, scenario.id), {});
  const answers = submission?.flagAnswers || {};
  const [file, setFile] = useState(null);          // newly picked File (display only)
  const [removeFile, setRemoveFile] = useState(false);
  const fileRef = useRef(null);
  const existingFile = submission?.reportFileName && !file && !removeFile ? submission.reportFileName : null;
  const clearFile = () => { if (fileRef.current) fileRef.current.value = ''; setFile(null); };
  // A student may re-do an assessment until the instructor commits it for
  // grading; after that the form locks to a read-only recap.
  const locked = scenario.type === 'ASSESSMENT' && Boolean(submission?.committed);
  const mono = { fontFamily: token.fontFamilyCode };
  const fileRow = { padding: '8px 12px', borderRadius: token.borderRadius, background: token.colorFillQuaternary, border: `1px solid ${token.colorBorderSecondary}` };

  return (
    <Flex vertical gap={16}>
      <Text type="secondary">{locked ? 'Your instructor has committed this for grading — it’s locked and awaiting your result.' : 'Answer the flags and (if required) write or upload your report. You can keep updating it until your instructor commits it for grading.'}</Text>
      {submission?.status === 'GRADED' && (
        <Alert
          type="success"
          showIcon
          icon={<TrophyOutlined />}
          title={<Text strong>Graded — {submission.grade ?? '—'} / 100</Text>}
          description={submission.feedback ? <RichText html={submission.feedback} /> : undefined}
        />
      )}
      {submission && submission.status !== 'GRADED' && (
        <Alert
          type={locked ? 'warning' : 'info'}
          showIcon
          icon={locked ? <LockOutlined /> : <ClockCircleOutlined />}
          title={locked ? 'Committed for grading — awaiting your result.' : 'Submitted — you can keep updating it until your instructor commits it for grading.'}
        />
      )}

      {locked ? (
        <>
          {scenario.flags.length > 0 && (
            <Card size="small" title={<Space><FlagOutlined />Your flag answers</Space>}>
              <Descriptions
                size="small"
                column={1}
                layout="vertical"
                items={scenario.flags.map((f, i) => ({
                  key: f.id,
                  label: `${i + 1}. ${f.question}`,
                  children: <Text style={mono}>{answers[f.id] || '— no answer —'}</Text>,
                }))}
              />
            </Card>
          )}
          <Card size="small" title={<Space><FileTextOutlined />Your report</Space>}>
            {submission.report ? (
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{submission.report}</Paragraph>
            ) : submission.reportFileName ? (
              <Button type="link" icon={<FileTextOutlined />} href={`/api/submissions/${submission.id}/report`} style={{ paddingInline: 0 }}>{submission.reportFileName}</Button>
            ) : (
              <Text type="secondary">No report submitted.</Text>
            )}
          </Card>
        </>
      ) : (
        <form action={preview ? undefined : action} onSubmit={preview ? (e) => e.preventDefault() : undefined}>
          <Flex vertical gap={16}>
            {scenario.flags.length > 0 && (
              <Card size="small" title={<Space><FlagOutlined />Flags</Space>}>
                <Flex vertical gap={14}>
                  {scenario.flags.map((f, i) => (
                    <Flex key={f.id} vertical gap={6}>
                      <label htmlFor={`flag-${f.id}`}>
                        <Text>{i + 1}. {f.question}</Text>
                        {f.points ? <Text type="secondary" style={{ fontSize: 12 }}> · {f.points} pts</Text> : null}
                      </label>
                      <Input id={`flag-${f.id}`} name={`flag:${f.id}`} defaultValue={answers[f.id] || ''} placeholder="Your answer" prefix={<FlagOutlined />} style={mono} />
                    </Flex>
                  ))}
                </Flex>
              </Card>
            )}

            <Card size="small" title={<Space><FileTextOutlined />Report {scenario.reportRequired ? <Tag color="red">required</Tag> : <Tag>optional</Tag>}</Space>}>
              {scenario.reportPrompt && <Paragraph type="secondary" style={{ fontSize: 13 }}>{scenario.reportPrompt}</Paragraph>}
              <Input.TextArea name="report" autoSize={{ minRows: 7, maxRows: 20 }} defaultValue={submission?.report || ''} placeholder="Write up your findings, timeline, and recommendations…" spellCheck={false} />

              <Flex align="center" gap={8} style={{ margin: '12px 0 8px' }}>
                <div style={{ flex: 1, height: 1, background: token.colorBorderSecondary }} />
                <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>or upload a document</Text>
                <div style={{ flex: 1, height: 1, background: token.colorBorderSecondary }} />
              </Flex>

              {removeFile && !file && <input type="hidden" name="removeReportFile" value="1" />}
              {/* Always-mounted so the picked File stays in the form submission. */}
              <input ref={fileRef} type="file" name="reportFile" accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword" style={{ display: 'none' }} onChange={(e) => { setFile(e.target.files?.[0] || null); setRemoveFile(false); }} />
              {file ? (
                <Flex align="center" gap={10} style={fileRow}>
                  <FileTextOutlined style={{ color: token.colorPrimary }} />
                  <Text ellipsis style={{ flex: 1, minWidth: 0 }}>{file.name} · {(file.size / 1024).toFixed(0)} KB</Text>
                  <Tooltip title="Remove"><Button type="text" size="small" icon={<CloseOutlined />} onClick={clearFile} /></Tooltip>
                </Flex>
              ) : existingFile ? (
                <Flex align="center" gap={10} style={fileRow}>
                  <FileDoneOutlined style={{ color: token.colorSuccess }} />
                  <Text ellipsis style={{ flex: 1, minWidth: 0 }}>{existingFile} <Text type="secondary">· uploaded</Text></Text>
                  {submission?.id && <Button type="text" size="small" icon={<DownloadOutlined />} href={`/api/submissions/${submission.id}/report`}>Open</Button>}
                  <Tooltip title="Remove"><Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setRemoveFile(true)} /></Tooltip>
                </Flex>
              ) : (
                <Button icon={<UploadOutlined />} onClick={() => fileRef.current?.click()} style={{ borderStyle: 'dashed' }}>Choose .pdf, .docx or .doc</Button>
              )}
            </Card>

            {state?.error && <Alert type="error" showIcon title={state.error} />}
            {state?.ok && <Alert type="success" showIcon title={state.ok} />}

            <Flex justify="flex-end">
              <Button htmlType="submit" type="primary" disabled={preview} loading={saving} icon={<SendOutlined />}>
                {preview ? 'Preview — not submitted' : submission ? 'Re-submit' : 'Submit deliverables'}
              </Button>
            </Flex>
          </Flex>
        </form>
      )}
    </Flex>
  );
}

/* Dojo flags, checked one at a time (instant feedback, persisted) — no batch
   submission. Assessment flags are graded by an instructor instead. */
function FlagChecklist({ scenario, scenarioId, solvedFlagIds, onFlagSolved, preview }) {
  const flags = scenario.flags || [];
  if (flags.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No flags to answer in this scenario." />;
  const solved = flags.filter((f) => (solvedFlagIds || []).includes(f.id)).length;
  return (
    <Flex vertical gap={12}>
      <Card size="small">
        <Flex align="center" gap={12}>
          <Progress type="circle" size={52} percent={Math.round((solved / flags.length) * 100)} format={() => `${solved}/${flags.length}`} />
          <Text type="secondary">Check each answer as you find it — instant feedback, no submission needed.</Text>
        </Flex>
      </Card>
      {flags.map((f, i) => (
        <FlagItem key={f.id} scenarioId={scenarioId} flag={f} index={i} solved={(solvedFlagIds || []).includes(f.id)} onSolved={onFlagSolved} preview={preview} />
      ))}
    </Flex>
  );
}

function FlagItem({ scenarioId, flag, index, solved, onSolved, preview }) {
  const { token } = theme.useToken();
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const [busy, start] = useTransition();

  const submit = () => {
    if (!answer.trim() || solved) return;
    setWrong(false);
    if (preview) {
      const ok = answer.trim().toLowerCase() === String(flag.answer ?? '').trim().toLowerCase();
      if (ok) onSolved?.(flag.id); else setWrong(true);
      return;
    }
    start(async () => {
      const res = await checkFlag(scenarioId, flag.id, answer);
      if (res.correct) onSolved?.(flag.id); else setWrong(true);
    });
  };

  return (
    <Card
      size="small"
      style={solved ? { borderColor: token.colorSuccessBorder, background: token.colorSuccessBg } : undefined}
    >
      <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
        {solved ? <CheckCircleFilled style={{ color: token.colorSuccess }} /> : <FlagOutlined style={{ color: token.colorPrimary }} />}
        <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Flag {index + 1}{flag.points ? ` · ${flag.points} pts` : ''}</Text>
        {solved && <Tag color="success">Solved</Tag>}
      </Flex>
      <Paragraph style={{ marginBottom: 10 }}>{flag.question}</Paragraph>
      {solved ? (
        <Text type="success"><CheckOutlined /> Correct.</Text>
      ) : (
        <Flex vertical gap={8}>
          <Space.Compact block>
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onPressEnter={(e) => { e.preventDefault(); submit(); }}
              placeholder="Your answer"
              prefix={<FlagOutlined />}
              status={wrong ? 'error' : undefined}
              style={{ fontFamily: token.fontFamilyCode }}
            />
            <Button type="primary" loading={busy} onClick={submit}>Check</Button>
          </Space.Compact>
          {wrong && <Text type="danger"><CloseOutlined /> Not quite — keep investigating.</Text>}
        </Flex>
      )}
    </Card>
  );
}

export default ScenarioWorkspace;
