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
  SUBMITTED: { tone: 'brand', label: 'Submitted', cta: 'Review' },
  GRADED: { tone: 'success', label: 'Graded', cta: 'Review' },
};

export function StudentHome({ user, scenarios }) {
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
                const st = STATUS_META[s.status];
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
        </div>
      </main>
    </div>
  );
}

export default StudentHome;
