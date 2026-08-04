'use client';
import React, { useState, useMemo, useEffect, useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { Markdown } from '@/components/Markdown';
import { StudentTopBar } from './StudentTopBar';
import { submitScenario } from '@/app/actions/submissions';
import { startRun, pauseRun, resumeRun } from '@/app/actions/runs';

const PANELS = [
  { id: 'brief', label: 'Brief', icon: 'BookOpen' },
  { id: 'alerts', label: 'Alerts', icon: 'Bell' },
  { id: 'logs', label: 'Logs', icon: 'ScrollText' },
  { id: 'endpoints', label: 'Endpoints', icon: 'MonitorSmartphone' },
  { id: 'artifacts', label: 'Artifacts', icon: 'Paperclip' },
  { id: 'submit', label: 'Submit', icon: 'Send' },
];

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

export function ScenarioWorkspace({ user, scenario, submission, initialRun }) {
  const router = useRouter();
  const [panel, setPanel] = useState('brief');
  const [run, setRun] = useState(initialRun);
  const [err, setErr] = useState(null);
  const [busy, startTransition] = useTransition();

  const canPause = scenario.type === 'DOJO';

  // Poll the feed while running (server is authoritative for elapsed + fired events).
  useEffect(() => {
    if (run.status !== 'RUNNING') return;
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
  }, [run.status, scenario.id]);

  // Smooth local clock between polls.
  useEffect(() => {
    if (run.status !== 'RUNNING') return;
    const id = setInterval(() => setRun((r) => ({ ...r, elapsed: (r.elapsed ?? 0) + 1 })), 1000);
    return () => clearInterval(id);
  }, [run.status]);

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
      <AC.IconButton label="Back to scenarios" onClick={() => router.push('/learn')}><Icon name="ArrowLeft" size={18} /></AC.IconButton>
      <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>{scenario.title}</span>
      <AC.Badge tone={scenario.type === 'ASSESSMENT' ? 'accent' : 'brand'} square>{scenario.type === 'ASSESSMENT' ? 'Assessment' : 'Dojo'}</AC.Badge>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-app)' }}>
      <StudentTopBar user={user} left={left} />

      {/* run control bar */}
      <div style={{ height: 46, flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-panel)' }}>
        <RunControls run={run} canPause={canPause} busy={busy} onRun={() => act(startRun)} onPause={() => act(pauseRun)} onResume={() => act(resumeRun)} />
        <div style={{ flex: 1 }} />
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
            {panel === 'brief' && <BriefPanel scenario={scenario} />}
            {panel === 'alerts' && <FeedPanel kind="alerts" run={run} />}
            {panel === 'logs' && <FeedPanel kind="logs" run={run} />}
            {panel === 'endpoints' && <EndpointsPanel endpoints={scenario.endpoints} />}
            {panel === 'artifacts' && <ArtifactsPanel endpoints={scenario.endpoints} />}
            {panel === 'submit' && <SubmitPanel scenario={scenario} submission={submission} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function RunControls({ run, canPause, busy, onRun, onPause, onResume }) {
  const status = run.status;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {status === 'NONE' && <AC.Button variant="primary" size="sm" loading={busy} leadingIcon={<Icon name="Play" size={14} />} onClick={onRun}>Run scenario</AC.Button>}
      {status === 'RUNNING' && (
        <>
          <AC.Badge tone="success" dot square>Running</AC.Badge>
          {canPause
            ? <AC.Button variant="secondary" size="sm" loading={busy} leadingIcon={<Icon name="Pause" size={14} />} onClick={onPause}>Pause</AC.Button>
            : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Assessment · runs to the end</span>}
        </>
      )}
      {status === 'PAUSED' && (
        <>
          <AC.Badge tone="warning" dot square>Paused</AC.Badge>
          <AC.Button variant="primary" size="sm" loading={busy} leadingIcon={<Icon name="Play" size={14} />} onClick={onResume}>Resume</AC.Button>
        </>
      )}
      {status !== 'NONE' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
          <Icon name="Timer" size={14} style={{ color: 'var(--text-tertiary)' }} /> T+{fmtClock(run.elapsed ?? 0)}
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

function FeedPanel({ kind, run }) {
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
      <PanelTitle icon="MonitorSmartphone" title="Endpoints" sub="EDR telemetry and OSQuery snapshots" />
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
        ) : <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No EDR data for this host.</span>}
      </AC.Card>

      <div style={{ height: 14 }} />

      <AC.Card header={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="TerminalSquare" size={16} style={{ color: 'var(--text-secondary)' }} /><span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>OSQuery · {ep.hostname}</span></div>}>
        {ep.osquery?.tables && Object.keys(ep.osquery.tables).length > 0 ? (
          Object.entries(ep.osquery.tables).map(([name, rows]) => <Section key={name} title={name}><DataTable rows={rows} /></Section>)
        ) : <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No OSQuery data for this host.</span>}
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

function SubmitPanel({ scenario, submission }) {
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

      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          <AC.Button type="submit" variant="primary" loading={saving} leadingIcon={<Icon name="Send" size={14} />}>{submission ? 'Re-submit' : 'Submit deliverables'}</AC.Button>
        </div>
      </form>
    </div>
  );
}

export default ScenarioWorkspace;
