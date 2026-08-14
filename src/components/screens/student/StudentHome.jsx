'use client';
import React from 'react';
import Link from 'next/link';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { StudentTopBar } from './StudentTopBar';

const TYPE_META = { DOJO: { tone: 'brand', label: 'Dojo' }, ASSESSMENT: { tone: 'accent', label: 'Assessment' } };
const STATUS_META = {
  NOT_STARTED: { tone: 'neutral', label: 'Not started', cta: 'Start' },
  IN_PROGRESS: { tone: 'accent', label: 'In progress', cta: 'Continue' },
  COMPLETED: { tone: 'brand', label: 'Completed', cta: 'Review' },
  SUBMITTED: { tone: 'brand', label: 'Submitted', cta: 'Review' },
  GRADED: { tone: 'success', label: 'Graded', cta: 'Review' },
};

export function StudentHome({ user, scenarios, standing, rank, leaderboard }) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-app)' }}>
      <StudentTopBar user={user} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Your scenarios</h1>
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>
              {user?.cohort ? <>Released to your cohort · <strong style={{ color: 'var(--text-secondary)' }}>{user.cohort}</strong></> : 'Scenarios released to you will appear here.'}
            </p>
          </div>

          <StandingBanner standing={standing} rank={rank} />

          {scenarios.length === 0 ? (
            <AC.Card>
              <AC.EmptyState
                icon={<Icon name="Compass" size={26} />}
                title="No scenarios yet"
                description={user?.cohort ? "Your instructor hasn't released any scenarios to your cohort yet. Check back soon." : "You're not in a cohort yet. Ask your instructor to add you."}
              />
            </AC.Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {scenarios.map((s) => {
                const st = STATUS_META[s.status] || STATUS_META.NOT_STARTED;
                return (
                  <AC.Card key={s.id}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 168 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AC.Badge tone={TYPE_META[s.type].tone} square>{TYPE_META[s.type].label}</AC.Badge>
                        <div style={{ flex: 1 }} />
                        <AC.Badge tone={st.tone} dot square>{st.label}{s.status === 'GRADED' && s.grade != null ? ` · ${s.grade}` : ''}</AC.Badge>
                      </div>
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{s.title}</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, flex: 1 }}>{s.description || 'No description.'}</p>
                      <Link href={`/learn/${s.id}`} style={{ textDecoration: 'none' }}>
                        <AC.Button variant="primary" size="sm" block trailingIcon={<Icon name="ArrowRight" size={14} />}>{st.cta}</AC.Button>
                      </Link>
                    </div>
                  </AC.Card>
                );
              })}
            </div>
          )}

          {leaderboard && leaderboard.length > 1 && <Leaderboard rows={leaderboard} meId={user?.id} />}
        </div>
      </main>
    </div>
  );
}

function StandingBanner({ standing, rank }) {
  const s = standing || { reputation: 0, title: 'Recruit', floor: 0, nextAt: 100, assessmentsGraded: 0 };
  const span = s.nextAt != null ? s.nextAt - s.floor : 0;
  const pct = s.nextAt != null && span > 0 ? Math.min(100, Math.round(((s.reputation - s.floor) / span) * 100)) : 100;

  return (
    <AC.Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--accent-subtle-bg, rgba(124,140,255,0.12))', border: '1px solid var(--accent-subtle-border, rgba(124,140,255,0.3))', display: 'grid', placeItems: 'center', color: 'var(--accent, #7c8cff)' }}>
            <Icon name="Award" size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{s.reputation}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>reputation</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{s.title}{rank ? <span style={{ color: 'var(--text-tertiary)' }}> · rank #{rank.rank} of {rank.total}</span> : null}</div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 5 }}>
            <span>{s.title}</span>
            <span>{s.nextAt != null ? `${s.reputation} / ${s.nextAt}` : 'Max level'}</span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: 'var(--surface-inset)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent, #7c8cff)', borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 6 }}>Earned from graded assessments · {s.assessmentsGraded} completed</div>
        </div>
      </div>
    </AC.Card>
  );
}

function Leaderboard({ rows, meId }) {
  return (
    <AC.Card header={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="Trophy" size={16} style={{ color: 'var(--text-secondary)' }} /><span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>Cohort standings</span></div>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((r, i) => {
          const me = r.id === meId;
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: me ? 'var(--accent-subtle-bg, rgba(124,140,255,0.1))' : 'transparent', border: '1px solid ' + (me ? 'var(--accent-subtle-border, rgba(124,140,255,0.25))' : 'transparent') }}>
              <span style={{ width: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: i < 3 ? 'var(--accent, #7c8cff)' : 'var(--text-tertiary)', fontWeight: i < 3 ? 700 : 400 }}>{i + 1}</span>
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
