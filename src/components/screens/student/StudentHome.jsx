'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { StudentTopBar } from './StudentTopBar';
import { RichText } from '@/components/RichText';

const TYPE_META = { DOJO: { tone: 'brand', label: 'Dojo' }, ASSESSMENT: { tone: 'accent', label: 'Assessment' } };
const STATUS_META = {
  NOT_STARTED: { tone: 'neutral', label: 'Not started', cta: 'Start' },
  IN_PROGRESS: { tone: 'accent', label: 'In progress', cta: 'Continue' },
  COMPLETED: { tone: 'brand', label: 'Completed', cta: 'Review' },
  SUBMITTED: { tone: 'brand', label: 'Submitted', cta: 'Review' },
  GRADED: { tone: 'success', label: 'Graded', cta: 'Review' },
};

const CAPABILITIES = [
  { icon: 'ScrollText', title: 'Discover logs', desc: 'Hunt through event logs with KQL search and a live histogram — just like Kibana Discover.' },
  { icon: 'Bell', title: 'Triage alerts', desc: 'Work the alert queue in real time: set a verdict, take notes, and extract IOCs on each case.' },
  { icon: 'TerminalSquare', title: 'EDR & OSQuery', desc: 'Inspect endpoint telemetry and run real SQL against host tables to find what happened.' },
  { icon: 'Paperclip', title: 'Evidence', desc: 'Download forensic artifacts and dig into the detail behind each incident.' },
  { icon: 'FileText', title: 'Report & grade', desc: 'Write up your findings and answer the flags. Your instructor grades and gives feedback.' },
];

const STEPS = [
  { icon: 'MousePointerClick', title: 'Open a scenario', desc: 'Dojos teach you; assessments are graded.' },
  { icon: 'Radar', title: 'Investigate', desc: 'Alerts, logs, EDR, OSQuery and artifacts — all in one workspace.' },
  { icon: 'Send', title: 'Submit', desc: 'Answer the flags and write your report to close the case.' },
];

export function StudentHome({ user, scenarios, standing, rank, leaderboard, results = [], preview }) {
  const stats = useMemo(() => {
    const by = (st) => scenarios.filter((s) => s.status === st).length;
    const inProgress = by('IN_PROGRESS');
    const done = by('COMPLETED') + by('SUBMITTED') + by('GRADED');
    const graded = results.length;
    const withGrade = results.filter((r) => r.grade != null);
    const avg = withGrade.length ? Math.round(withGrade.reduce((a, r) => a + r.grade, 0) / withGrade.length) : null;
    return { inProgress, done, graded, avg };
  }, [scenarios, results]);

  const nextUp = useMemo(
    () => scenarios.find((s) => s.status === 'IN_PROGRESS') || scenarios.find((s) => s.status === 'NOT_STARTED') || null,
    [scenarios],
  );
  const isNew = stats.done === 0;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-app)' }}>
      <StudentTopBar user={user} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Hero user={user} standing={standing} rank={rank} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <AC.StatCard label="In progress" value={String(stats.inProgress)} icon={<Icon name="Radar" size={16} />} hint="Active investigations" />
            <AC.StatCard label="Completed" value={String(stats.done)} icon={<Icon name="CircleCheck" size={16} />} hint="Scenarios finished" />
            <AC.StatCard label="Graded" value={String(stats.graded)} icon={<Icon name="Award" size={16} />} hint="Assessments returned" />
            <AC.StatCard label="Avg. grade" value={stats.avg != null ? `${stats.avg}` : '—'} tone={stats.avg != null ? 'accent' : 'default'} icon={<Icon name="TrendingUp" size={16} />} hint="Across released grades" />
          </div>

          {nextUp && <NextUp scenario={nextUp} />}

          {isNew && <HowItWorks />}

          <div>
            <SectionTitle icon="Boxes" title="Your scenarios" hint={scenarios.length ? `${scenarios.length} released to your cohort` : undefined} />
            {scenarios.length === 0 ? (
              <Onboarding hasCohort={Boolean(user?.cohort)} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {scenarios.map((s) => {
                  const st = STATUS_META[s.status] || STATUS_META.NOT_STARTED;
                  return (
                    <AC.Card key={s.id} hover>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 172 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AC.Badge tone={TYPE_META[s.type].tone} square>{TYPE_META[s.type].label}</AC.Badge>
                          <div style={{ flex: 1 }} />
                          <AC.Badge tone={st.tone} dot square>{st.label}{s.status === 'GRADED' && s.grade != null ? ` · ${s.grade}` : ''}</AC.Badge>
                        </div>
                        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{s.title}</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, flex: 1 }}>{s.description || 'No description.'}</p>
                        <Link href={`/learn/${s.id}`} style={{ textDecoration: 'none' }}>
                          <AC.Button variant={s.status === 'NOT_STARTED' ? 'primary' : 'secondary'} size="sm" block trailingIcon={<Icon name="ArrowRight" size={14} />}>{st.cta}</AC.Button>
                        </Link>
                      </div>
                    </AC.Card>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <SectionTitle icon="Crosshair" title="Inside the lab" hint="The tools you'll use on every case" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {CAPABILITIES.map((c) => (
                <AC.Card key={c.title}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--brand-subtle-bg)', border: '1px solid var(--brand-subtle-border)', color: 'var(--brand)' }}>
                      <Icon name={c.icon} size={17} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{c.desc}</div>
                  </div>
                </AC.Card>
              ))}
            </div>
          </div>

          {results.length > 0 && <Results results={results} />}

          {leaderboard && leaderboard.length > 1 && <Leaderboard rows={leaderboard} meId={user?.id} />}
        </div>
      </main>
    </div>
  );
}

/* ---- Hero: analyst profile + rank ring ---- */
function Hero({ user, standing, rank }) {
  const s = standing || { reputation: 0, title: 'Recruit', level: 1, floor: 0, nextAt: 100, assessmentsGraded: 0 };
  const span = s.nextAt != null ? s.nextAt - s.floor : 0;
  const pct = s.nextAt != null && span > 0 ? Math.min(100, Math.round(((s.reputation - s.floor) / span) * 100)) : 100;
  const first = (user?.name || 'analyst').split(' ')[0];

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 16, padding: 26,
      background: 'linear-gradient(120deg, var(--brand) 0%, var(--blue-800) 55%, var(--blue-950) 100%)',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '38px 38px', maskImage: 'radial-gradient(120% 80% at 100% 0%, #000, transparent 70%)', WebkitMaskImage: 'radial-gradient(120% 80% at 100% 0%, #000, transparent 70%)' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', marginBottom: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--highlight-yellow)' }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#fff', letterSpacing: '0.02em' }}>SOC Analyst · {user?.cohort || 'Unassigned'}</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Welcome back, {first}</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.5, maxWidth: 460 }}>
            You're a <strong style={{ color: '#fff' }}>{s.title}</strong>{rank ? <> · ranked <strong style={{ color: '#fff' }}>#{rank.rank}</strong> of {rank.total} in your cohort</> : null}. Keep working cases to climb.
          </p>
          <div style={{ marginTop: 16, maxWidth: 360 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginBottom: 5 }}>
              <span>{s.reputation} rep</span>
              <span>{s.nextAt != null ? `next: ${s.nextAt}` : 'Max level'}</span>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--highlight-yellow)', borderRadius: 999 }} />
            </div>
          </div>
        </div>
        <RankRing level={s.level || 1} pct={pct} title={s.title} />
      </div>
    </div>
  );
}

function RankRing({ level, pct, title }) {
  const r = 40, C = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: 130, textAlign: 'center', flex: 'none' }}>
      <svg width={110} height={110} viewBox="0 0 110 110" style={{ display: 'block', margin: '0 auto' }}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="8" />
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--highlight-yellow)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C - (pct / 100) * C} transform="rotate(-90 55 55)" />
        <text x="55" y="50" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="700" fontFamily="var(--font-mono)">{level}</text>
        <text x="55" y="68" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10" letterSpacing="1.5">LEVEL</text>
      </svg>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginTop: 4 }}>{title}</div>
    </div>
  );
}

function SectionTitle({ icon, title, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
      <Icon name={icon} size={17} style={{ color: 'var(--text-secondary)', transform: 'translateY(3px)' }} />
      <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
      {hint && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{hint}</span>}
    </div>
  );
}

function NextUp({ scenario }) {
  const inProgress = scenario.status === 'IN_PROGRESS';
  return (
    <AC.Card accent>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--brand-subtle-bg)', border: '1px solid var(--brand-subtle-border)', display: 'grid', placeItems: 'center', color: 'var(--brand)', flex: 'none' }}>
          <Icon name={inProgress ? 'Play' : 'Rocket'} size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{inProgress ? 'Pick up where you left off' : 'Start your next scenario'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{scenario.title}</div>
        </div>
        <Link href={`/learn/${scenario.id}`} style={{ textDecoration: 'none' }}>
          <AC.Button variant="primary" trailingIcon={<Icon name="ArrowRight" size={15} />}>{inProgress ? 'Continue' : 'Start'}</AC.Button>
        </Link>
      </div>
    </AC.Card>
  );
}

function HowItWorks() {
  return (
    <div>
      <SectionTitle icon="Route" title="How it works" hint="Three steps to your first solved case" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {STEPS.map((s, i) => (
          <AC.Card key={s.title}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', border: '1px solid var(--border-default)', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>{i + 1}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}><Icon name={s.icon} size={15} style={{ color: 'var(--text-secondary)' }} />{s.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 3 }}>{s.desc}</div>
              </div>
            </div>
          </AC.Card>
        ))}
      </div>
    </div>
  );
}

function Onboarding({ hasCohort }) {
  return (
    <AC.Card>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--brand-subtle-bg)', border: '1px solid var(--brand-subtle-border)', color: 'var(--brand)' }}>
          <Icon name={hasCohort ? 'Clock' : 'UserPlus'} size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {hasCohort ? 'No scenarios released yet' : "You're not in a cohort yet"}
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, maxWidth: 560 }}>
            {hasCohort
              ? "Your instructor hasn't released any scenarios to your cohort yet. As soon as they do, they'll show up here — and you'll get a heads-up when new alerts start firing. In the meantime, here's what the lab has in store."
              : 'Ask your instructor to add you to a cohort. Once you’re in, released scenarios will appear here and you can start working real SOC cases.'}
          </p>
        </div>
      </div>
    </AC.Card>
  );
}

function Results({ results }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const gradeTone = (g) => (g == null ? 'neutral' : g >= 75 ? 'success' : g >= 50 ? 'accent' : 'danger');
  return (
    <div>
      <SectionTitle icon="Award" title="Results & feedback" hint="Released by your instructor" />
      <AC.Card padded={false}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {results.map((r, i) => {
            const isOpen = open.has(r.id);
            const hasDetail = r.feedback || r.reportFileName;
            return (
              <div key={r.id} style={{ borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                <button onClick={() => hasDetail && toggle(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', background: 'none', border: 'none', cursor: hasDetail ? 'pointer' : 'default' }}>
                  <AC.Badge tone={TYPE_META[r.type].tone} square>{TYPE_META[r.type].label}</AC.Badge>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.scenarioTitle}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{r.releasedAt.slice(0, 10)}</span>
                  <AC.Badge tone={gradeTone(r.grade)} square>{r.grade != null ? `${r.grade} / 100` : '—'}</AC.Badge>
                  {hasDetail && <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={16} style={{ color: 'var(--text-tertiary)', flex: 'none' }} />}
                </button>
                {isOpen && hasDetail && (
                  <div style={{ padding: '0 14px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {r.feedback && (
                      <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>Instructor feedback</div>
                        <RichText html={r.feedback} />
                      </div>
                    )}
                    {r.reportFileName && (
                      <a href={`/api/submissions/${r.id}/report`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', fontSize: 12.5, color: 'var(--text-link)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="FileText" size={14} /> Your submitted report ({r.reportFileName})
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </AC.Card>
    </div>
  );
}

function Leaderboard({ rows, meId }) {
  return (
    <AC.Card header={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="Trophy" size={16} style={{ color: 'var(--text-secondary)' }} /><span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>Cohort standings</span></div>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((r, i) => {
          const me = r.id === meId;
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: me ? 'var(--accent-subtle-bg)' : 'transparent', border: '1px solid ' + (me ? 'var(--accent-subtle-border)' : 'transparent') }}>
              <span style={{ width: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: i < 3 ? 'var(--accent)' : 'var(--text-tertiary)', fontWeight: i < 3 ? 700 : 400 }}>{i + 1}</span>
              <AC.Avatar name={r.name} size="sm" />
              <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-primary)' }}>{r.name}{me ? <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}> · you</span> : null}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.assessments} assessment{r.assessments === 1 ? '' : 's'}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', width: 44, textAlign: 'right' }}>{r.reputation}</span>
            </div>
          );
        })}
      </div>
    </AC.Card>
  );
}

export default StudentHome;
