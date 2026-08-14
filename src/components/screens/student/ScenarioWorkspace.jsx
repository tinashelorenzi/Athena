'use client';
import React, { useState, useMemo, useEffect, useRef, useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { Markdown } from '@/components/Markdown';
import { StudentTopBar } from './StudentTopBar';
import { GuideView } from './GuideView';
import { AlertCaseDialog } from './AlertCaseDialog';
import { LogsPanel } from './LogsPanel';
import { feedAtClient } from './previewFeed';

// alasql (used by OSQueryPanel) only bundles for the browser, so load it client-only.
const OSQueryPanel = dynamic(() => import('./OSQueryPanel').then((m) => m.OSQueryPanel), { ssr: false });
import { submitScenario } from '@/app/actions/submissions';
import { startRun, pauseRun, resumeRun, completeRun } from '@/app/actions/runs';

const BASE_PANELS = [
  { id: 'brief', label: 'Brief', icon: 'BookOpen' },
  { id: 'alerts', label: 'Alerts', icon: 'Bell' },
  { id: 'logs', label: 'Logs', icon: 'ScrollText' },
  { id: 'osquery', label: 'OSQuery', icon: 'TerminalSquare' },
  { id: 'endpoints', label: 'EDR', icon: 'MonitorSmartphone' },
  { id: 'artifacts', label: 'Artifacts', icon: 'Paperclip' },
  { id: 'submit', label: 'Submit', icon: 'Send' },
];

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

export function ScenarioWorkspace({ user, scenario, submission, initialRun, solvedIds, initialCases, preview = false }) {
  const router = useRouter();
  const PANELS = scenario.hasGuide ? [{ id: 'guide', label: 'Guide', icon: 'GraduationCap' }, ...BASE_PANELS] : BASE_PANELS;
  const [panel, setPanel] = useState(scenario.hasGuide ? 'guide' : 'brief');
  const [run, setRun] = useState(initialRun);
  const [err, setErr] = useState(null);
  const [busy, startTransition] = useTransition();
  const [cases, setCases] = useState(initialCases || {});
  const [caseAlert, setCaseAlert] = useState(null);

  // Preview mode: an ephemeral, client-side clock (no server actions, no storage).
  const startRef = useRef(0);
  const accumRef = useRef(0);

  const canPause = scenario.type === 'DOJO' && !scenario.realtime;

  const hasRun = run.status !== 'NONE';
  const [wsOpen, setWsOpen] = useState(false);

  // Live feed over WebSocket (real-time push). Falls back to polling if the
  // socket can't connect (e.g. nginx `/ws` upgrade not configured).
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
      socket.onopen = () => { setWsOpen(true); socket.send(JSON.stringify({ type: 'subscribe', scenarioId: scenario.id })); };
      socket.onmessage = (e) => {
        try { const d = JSON.parse(e.data); if (d.type === 'feed') setRun((r) => ({ ...r, ...d })); } catch { /* ignore */ }
      };
      socket.onclose = () => { setWsOpen(false); if (!closed) retry = setTimeout(connect, 5000); };
      socket.onerror = () => { try { socket.close(); } catch { /* ignore */ } };
    };
    connect();
    return () => { closed = true; clearTimeout(retry); setWsOpen(false); try { socket && socket.close(); } catch { /* ignore */ } };
  }, [scenario.id, hasRun]);

  // Poll fallback while running when the WebSocket isn't connected.
  useEffect(() => {
    if (preview || run.status !== 'RUNNING' || wsOpen) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/runs/${scenario.id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setRun((r) => ({ ...r, ...data }));
      } catch { /* transient */ }
    };
    const id = setInterval(poll, 2500);
    return () => { active = false; clearInterval(id); };
  }, [run.status, scenario.id, wsOpen]);

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
    accumRef.current = 0; startRef.current = Date.now();
    setRun((r) => ({ ...r, status: 'RUNNING', elapsed: 0, ...feedAtClient(scenario.rawAlerts, scenario.rawLogs, 0) }));
  };
  const doPause = () => {
    if (!preview) return act(pauseRun);
    const e = Math.floor(accumRef.current + (Date.now() - startRef.current) / 1000);
    accumRef.current = e; setRun((r) => ({ ...r, status: 'PAUSED', elapsed: e }));
  };
  const doResume = () => {
    if (!preview) return act(resumeRun);
    startRef.current = Date.now(); setRun((r) => ({ ...r, status: 'RUNNING' }));
  };
  const doComplete = () => {
    if (!preview) return act(completeRun);
    const e = Math.floor(accumRef.current + (run.status === 'RUNNING' ? (Date.now() - startRef.current) / 1000 : 0));
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

  const left = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <AC.IconButton label="Back" onClick={() => router.push(preview ? `/admin/scenarios/${scenario.id}` : '/learn')}><Icon name="ArrowLeft" size={18} /></AC.IconButton>
      <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>{scenario.title}</span>
      <AC.Badge tone={scenario.type === 'ASSESSMENT' ? 'accent' : 'brand'} square>{scenario.type === 'ASSESSMENT' ? 'Assessment' : 'Dojo'}</AC.Badge>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-app)' }}>
      <StudentTopBar user={user} left={left} />

      {/* run control bar */}
      <div style={{ height: 46, flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-panel)' }}>
        <RunControls run={run} canPause={canPause} realtime={scenario.realtime} busy={busy} onRun={doRun} onPause={doPause} onResume={doResume} onComplete={doComplete} />
        {preview && <AC.Badge tone="accent" square>Preview</AC.Badge>}
        <div style={{ flex: 1 }} />
        {scenario.realtime && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--status-danger, #ef4444)' }}>
            <Icon name="Radio" size={14} /> Real-time — runs continuously, no pausing
          </span>
        )}
        {err && <span style={{ fontSize: 12.5, color: 'var(--status-danger, #ef4444)' }}>{err}</span>}
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <nav style={{ width: 176, flex: 'none', borderRight: '1px solid var(--border-subtle)', background: 'var(--surface-panel)', padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {PANELS.map((p) => {
            const active = panel === p.id;
            return (
              <button key={p.id} onClick={() => setPanel(p.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                background: active ? 'var(--accent-subtle-bg, rgba(124,140,255,0.12))' : 'transparent',
                border: '1px solid ' + (active ? 'var(--accent-subtle-border, rgba(124,140,255,0.3))' : 'transparent'),
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, fontWeight: active ? 600 : 500, textAlign: 'left',
              }}>
                <Icon name={p.icon} size={16} /> {p.label}
                {p.id === 'alerts' && run.alerts?.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{run.alerts.length}</span>}
              </button>
            );
          })}
        </nav>

        <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
            {panel === 'guide' && (
              <div>
                <PanelTitle icon="GraduationCap" title="Guide" sub="Work through the guide and solve the prompts as you go." />
                <GuideView scenarioId={scenario.id} markdown={scenario.guide} prompts={scenario.guidePrompts} solvedIds={solvedIds} preview={preview} />
              </div>
            )}
            {panel === 'brief' && <BriefPanel scenario={scenario} />}
            {panel === 'alerts' && <FeedPanel kind="alerts" run={run} cases={cases} onOpenCase={setCaseAlert} />}
            {panel === 'logs' && <LogsPanel run={run} />}
            {panel === 'osquery' && <OSQueryPanel endpoints={scenario.endpoints} />}
            {panel === 'endpoints' && <EndpointsPanel endpoints={scenario.endpoints} />}
            {panel === 'artifacts' && <ArtifactsPanel endpoints={scenario.endpoints} />}
            {panel === 'submit' && <SubmitPanel scenario={scenario} submission={submission} preview={preview} />}
          </div>
        </main>
      </div>

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
    </div>
  );
}

function RunControls({ run, canPause, realtime, busy, onRun, onPause, onResume, onComplete }) {
  const status = run.status;
  const noPauseNote = realtime ? 'Real-time · no pausing' : 'Assessment · runs to the end';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {status === 'NONE' && <AC.Button variant="primary" size="sm" loading={busy} leadingIcon={<Icon name="Play" size={14} />} onClick={onRun}>Run scenario</AC.Button>}
      {status === 'RUNNING' && (
        <>
          <AC.Badge tone="success" dot square>Running</AC.Badge>
          {canPause
            ? <AC.Button variant="secondary" size="sm" loading={busy} leadingIcon={<Icon name="Pause" size={14} />} onClick={onPause}>Pause</AC.Button>
            : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{noPauseNote}</span>}
          <AC.Button variant="ghost" size="sm" loading={busy} leadingIcon={<Icon name="Flag" size={14} />} onClick={onComplete}>Finish</AC.Button>
        </>
      )}
      {status === 'PAUSED' && (
        <>
          <AC.Badge tone="warning" dot square>Paused</AC.Badge>
          <AC.Button variant="primary" size="sm" loading={busy} leadingIcon={<Icon name="Play" size={14} />} onClick={onResume}>Resume</AC.Button>
          <AC.Button variant="ghost" size="sm" loading={busy} leadingIcon={<Icon name="Flag" size={14} />} onClick={onComplete}>Finish</AC.Button>
        </>
      )}
      {status === 'COMPLETED' && <AC.Badge tone="brand" dot square>Completed</AC.Badge>}
      {status !== 'NONE' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
          <Icon name="Timer" size={14} style={{ color: 'var(--text-tertiary)' }} /> T+{fmtClock(run.elapsed ?? 0)}{status === 'COMPLETED' ? ' · final' : ''}
        </span>
      )}
    </div>
  );
}

function NotRunning({ icon, label }) {
  return (
    <AC.Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-tertiary)', fontSize: 13 }}>
        <Icon name={icon} size={16} /> Press <strong style={{ color: 'var(--text-secondary)' }}>Run scenario</strong> to begin the {label} feed.
      </div>
    </AC.Card>
  );
}

function PanelTitle({ icon, title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <Icon name={icon} size={18} style={{ color: 'var(--text-secondary)' }} />
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{sub}</div>}
      </div>
    </div>
  );
}

function BriefPanel({ scenario }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PanelTitle icon="BookOpen" title="Briefing" />
      <AC.Card>{scenario.brief ? <Markdown>{scenario.brief}</Markdown> : <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No briefing provided.</span>}</AC.Card>
      {scenario.objectives?.length > 0 && (
        <AC.Card header={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="Target" size={16} style={{ color: 'var(--text-secondary)' }} /><span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>Objectives</span></div>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scenario.objectives.map((o, i) => (
              <div key={o.id || i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--surface-inset)', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)', fontSize: 11, display: 'grid', placeItems: 'center', flex: 'none', marginTop: 1 }}>{i + 1}</div>
                <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{o.text}</span>
              </div>
            ))}
          </div>
        </AC.Card>
      )}
    </div>
  );
}

const VERDICT_META = {
  TRUE_POSITIVE: { label: 'TP', tone: 'danger' },
  FALSE_POSITIVE: { label: 'FP', tone: 'neutral' },
  BENIGN: { label: 'Benign', tone: 'success' },
  ESCALATED: { label: 'Esc', tone: 'warning' },
};

function FeedPanel({ kind, run, cases, onOpenCase }) {
  const isAlerts = kind === 'alerts';
  const items = (isAlerts ? run.alerts : run.logs) || [];
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (isAlerts) return items;
    const s = q.trim().toLowerCase();
    return s ? items.filter((e) => JSON.stringify(e).toLowerCase().includes(s)) : items;
  }, [items, q, isAlerts]);

  if (run.status === 'NONE') {
    return (<div><PanelTitle icon={isAlerts ? 'Bell' : 'ScrollText'} title={isAlerts ? 'Alert queue' : 'Logs'} /><NotRunning icon={isAlerts ? 'Bell' : 'ScrollText'} label={isAlerts ? 'alert' : 'log'} /></div>);
  }

  return (
    <div>
      <PanelTitle icon={isAlerts ? 'Bell' : 'ScrollText'} title={isAlerts ? 'Alert queue' : 'Logs'} sub={`${items.length} ${isAlerts ? 'fired' : 'entries'}${run.status === 'PAUSED' ? ' · paused' : ''}`} />
      {!isAlerts && (
        <div style={{ marginBottom: 12, maxWidth: 320 }}>
          <AC.Input size="sm" placeholder="Filter logs…" value={q} onChange={(e) => setQ(e.target.value)} leadingIcon={<Icon name="Search" size={15} />} />
        </div>
      )}
      {items.length === 0 ? (
        <AC.Card><div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 13 }}><AC.Spinner size={14} /> {run.status === 'PAUSED' ? 'Paused — resume to continue the feed.' : `Monitoring… ${isAlerts ? 'alerts' : 'logs'} will appear as they fire.`}</div></AC.Card>
      ) : isAlerts ? (
        <AC.Card padded={false}>
          <AC.Table
            rowKey="id"
            hover={false}
            columns={[
              { key: 'seek', header: 'At', width: '70px', mono: true, render: (v) => `T+${v ?? 0}s` },
              { key: 'title', header: 'Alert', primary: true },
              { key: 'host', header: 'Host', mono: true, width: '120px' },
              { key: 'source', header: 'Source → Dest', mono: true, render: (_v, r) => `${r.source || '—'} → ${r.destination || '—'}` },
              { key: 'rule', header: 'Rule', mono: true, width: '120px', render: (v) => v || '—' },
              { key: 'count', header: 'Events', align: 'right', mono: true, width: '80px', render: (v) => v ?? '—' },
              {
                key: 'id', header: 'Case', width: '150px', align: 'right',
                render: (_v, row) => {
                  const c = cases?.[row.id];
                  const vm = c?.verdict ? VERDICT_META[c.verdict] : null;
                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      {vm && <AC.Badge tone={vm.tone} square>{vm.label}</AC.Badge>}
                      {c?.status === 'CLOSED' && <Icon name="CircleCheck" size={13} style={{ color: 'var(--status-success, #22c55e)' }} />}
                      <AC.Button variant={c ? 'ghost' : 'secondary'} size="sm" leadingIcon={<Icon name="Gavel" size={13} />} onClick={() => onOpenCase?.(row)}>{c ? 'Edit' : 'Triage'}</AC.Button>
                    </div>
                  );
                },
              },
            ]}
            rows={items.map((a, i) => ({ ...a, id: a.id ?? `a${i}` }))}
          />
        </AC.Card>
      ) : (
        <AC.Card padded={false}>
          <AC.Table
            rowKey="__k"
            compact
            hover={false}
            columns={[
              { key: 'ts', header: 'Time', mono: true, width: '190px' },
              { key: 'host', header: 'Host', mono: true, width: '110px' },
              { key: 'source', header: 'Source', mono: true, width: '90px' },
              { key: 'action', header: 'Action', mono: true, width: '140px' },
              { key: 'user', header: 'User', mono: true, width: '100px', render: (v) => v || '—' },
              { key: 'message', header: 'Message', mono: true, render: (v) => <span style={{ wordBreak: 'break-all' }}>{v}</span> },
            ]}
            rows={filtered.map((e, i) => ({ ...e, __k: i }))}
          />
        </AC.Card>
      )}
    </div>
  );
}

function ProcessTree({ nodes, depth = 0 }) {
  if (!Array.isArray(nodes)) return null;
  return (
    <>
      {nodes.map((p, i) => (
        <div key={`${p.pid}-${i}`}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', paddingLeft: depth * 20 }}>
            <Icon name="ChevronRight" size={12} style={{ color: 'var(--text-tertiary)', opacity: depth ? 1 : 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-primary)' }}>{p.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-tertiary)' }}>pid {p.pid}{p.user ? ` · ${p.user}` : ''}</span>
            {p.cmd && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-tertiary)', wordBreak: 'break-all' }}>{p.cmd}</span>}
          </div>
          {Array.isArray(p.children) && p.children.length > 0 && <ProcessTree nodes={p.children} depth={depth + 1} />}
        </div>
      ))}
    </>
  );
}

const fmt = (v) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
function DataTable({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) return <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No rows.</span>;
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r || {})))];
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        <thead><tr>{cols.map((c) => <th key={c} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap', fontWeight: 600 }}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (<tr key={i}>{cols.map((c) => <td key={c} style={{ padding: '6px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>{fmt(r[c])}</td>)}</tr>))}</tbody>
      </table>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function EndpointsPanel({ endpoints }) {
  const [host, setHost] = useState(endpoints[0]?.id ?? null);
  const ep = endpoints.find((e) => e.id === host) || endpoints[0];
  if (endpoints.length === 0) return (<div><PanelTitle icon="MonitorSmartphone" title="Endpoints" /><AC.Card><span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No endpoint data in this scenario.</span></AC.Card></div>);

  return (
    <div>
      <PanelTitle icon="MonitorSmartphone" title="EDR" sub="Endpoint detection & response telemetry" />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {endpoints.map((e) => (
          <button key={e.id} onClick={() => setHost(e.id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12.5,
            background: e.id === ep.id ? 'var(--surface-raised)' : 'var(--surface-inset)',
            border: '1px solid ' + (e.id === ep.id ? 'var(--border-default)' : 'var(--border-subtle)'),
            color: e.id === ep.id ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}><Icon name="Server" size={13} /> {e.hostname}</button>
        ))}
      </div>

      <AC.Card header={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="Cpu" size={16} style={{ color: 'var(--text-secondary)' }} /><span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>EDR · {ep.hostname}</span></div>}>
        {ep.edr ? (
          <>
            {Array.isArray(ep.edr.processes) && ep.edr.processes.length > 0 && <Section title="Process tree"><div style={{ overflow: 'auto' }}><ProcessTree nodes={ep.edr.processes} /></div></Section>}
            {Array.isArray(ep.edr.connections) && ep.edr.connections.length > 0 && <Section title="Network connections"><DataTable rows={ep.edr.connections} /></Section>}
            {Array.isArray(ep.edr.browserHistory) && ep.edr.browserHistory.length > 0 && <Section title="Browser history"><DataTable rows={ep.edr.browserHistory} /></Section>}
            {Array.isArray(ep.edr.shellHistory) && ep.edr.shellHistory.length > 0 && <Section title="Shell history"><DataTable rows={ep.edr.shellHistory} /></Section>}
          </>
        ) : <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No EDR data for this host. Try the OSQuery tab.</span>}
      </AC.Card>
    </div>
  );
}

function ArtifactsPanel({ endpoints }) {
  const withArtifacts = endpoints.filter((e) => e.hasArtifact);
  return (
    <div>
      <PanelTitle icon="Paperclip" title="Artifacts" sub="Downloadable evidence per host" />
      {withArtifacts.length === 0 ? (
        <AC.Card><span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No evidence artifacts in this scenario.</span></AC.Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {withArtifacts.map((e) => (
            <AC.Card key={e.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-default)', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}><Icon name="FileArchive" size={18} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>{e.hostname}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{e.artifactName || 'artifact.zip'}{e.artifactSize ? ` · ${(e.artifactSize / 1024).toFixed(0)} KB` : ''}</div>
                </div>
                <a href={`/api/artifacts/${e.id}`} style={{ textDecoration: 'none' }}>
                  <AC.Button variant="secondary" size="sm" leadingIcon={<Icon name="Download" size={14} />}>Download</AC.Button>
                </a>
              </div>
            </AC.Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmitPanel({ scenario, submission, preview }) {
  const [state, action, saving] = useActionState(submitScenario.bind(null, scenario.id), {});
  const answers = submission?.flagAnswers || {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PanelTitle icon="Send" title="Submit deliverables" sub="Answer the flags and (if required) write your report." />
      {submission?.status === 'GRADED' && (
        <AC.Card accent>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="Award" size={22} style={{ color: 'var(--status-success, #22c55e)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Graded — {submission.grade ?? '—'} / 100</div>
              {submission.feedback && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{submission.feedback}</div>}
            </div>
          </div>
        </AC.Card>
      )}
      {submission && submission.status !== 'GRADED' && (
        <AC.Card><div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}><Icon name="Clock" size={15} /> Submitted — awaiting grading. You can re-submit to update your answers.</div></AC.Card>
      )}

      <form action={preview ? undefined : action} onSubmit={preview ? (e) => e.preventDefault() : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {scenario.flags.length > 0 && (
          <AC.Card header={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="Flag" size={16} style={{ color: 'var(--text-secondary)' }} /><span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>Flags</span></div>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {scenario.flags.map((f, i) => (
                <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-primary)' }}>{i + 1}. {f.question}{f.points ? <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}> · {f.points} pts</span> : null}</label>
                  <AC.Input name={`flag:${f.id}`} defaultValue={answers[f.id] || ''} placeholder="Your answer" mono leadingIcon={<Icon name="Flag" size={15} />} />
                </div>
              ))}
            </div>
          </AC.Card>
        )}

        <AC.Card header={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="FileText" size={16} style={{ color: 'var(--text-secondary)' }} /><span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>Report {scenario.reportRequired ? '(required)' : '(optional)'}</span></div>}>
          {scenario.reportPrompt && <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '0 0 10px', lineHeight: 1.5 }}>{scenario.reportPrompt}</p>}
          <textarea name="report" rows={8} defaultValue={submission?.report || ''} placeholder="Write up your findings, timeline, and recommendations…" spellCheck={false}
            style={{ width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-inset)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5 }} />
        </AC.Card>

        {state?.error && <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--status-danger, #ef4444)' }}><Icon name="TriangleAlert" size={15} /> {state.error}</div>}
        {state?.ok && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--status-success, #22c55e)' }}><Icon name="CircleCheck" size={15} /> {state.ok}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <AC.Button type="submit" variant="primary" disabled={preview} loading={saving} leadingIcon={<Icon name="Send" size={14} />}>{preview ? 'Preview — not submitted' : submission ? 'Re-submit' : 'Submit deliverables'}</AC.Button>
        </div>
      </form>
    </div>
  );
}

export default ScenarioWorkspace;
