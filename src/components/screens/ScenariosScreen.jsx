'use client';
import React from 'react';
import { Card as ScCard, Badge as ScBadge, Button as ScBtn, ProgressBar as ScProg, Tabs as ScTabs } from '@/components/ds';
import { Icon } from '@/components/Icon';
import { AthenaData } from '@/lib/data';

/* Scenarios catalog — browse, read briefing, start a scenario. */
const DIFF_TONE = { Beginner: 'success', Intermediate: 'warning', Advanced: 'danger' };
const STATUS_LABEL = { active: 'In progress', available: 'Available', completed: 'Completed' };

function ScenarioCard({ s, onStart }) {
  const done = s.status === 'completed';
  const active = s.status === 'active';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', background: 'var(--surface-card)',
      border: `1px solid ${active ? 'var(--accent-subtle-border)' : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--edge-highlight)',
    }}>
      <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{s.id}</span>
        <ScBadge tone="neutral">{s.tag}</ScBadge>
        <div style={{ flex: 1 }} />
        {active && <ScBadge tone="accent" dot>In progress</ScBadge>}
        {done && <ScBadge tone="success" dot>Completed</ScBadge>}
      </div>

      <div style={{ padding: '12px 18px 16px', flex: 1 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>{s.title}</h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-tertiary)', margin: '0 0 14px' }}>{s.desc}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {s.tactics.map((t) => (
            <span key={t} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 999, padding: '2px 9px' }}>{t}</span>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 18px 12px', display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="Signal" size={13} style={{ color: `var(--sev-${DIFF_TONE[s.difficulty] === 'danger' ? 'critical' : DIFF_TONE[s.difficulty] === 'warning' ? 'medium' : 'low'})` }} />{s.difficulty}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="Clock" size={13} />{s.mins} min</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="ListChecks" size={13} />{s.total} objectives</span>
      </div>

      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {(active || done) ? (
          <>
            <div style={{ flex: 1 }}>
              <ScProg value={s.progress} max={s.total} tone={done ? 'success' : 'accent'} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{s.progress}/{s.total}</span>
            <ScBtn variant={active ? 'primary' : 'secondary'} size="sm" onClick={onStart} trailingIcon={<Icon name="ArrowRight" size={15} />}>
              {active ? 'Resume' : 'Review'}
            </ScBtn>
          </>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-tertiary)' }}>Not started</span>
            <ScBtn variant="primary" size="sm" onClick={onStart} leadingIcon={<Icon name="Play" size={14} />}>Start scenario</ScBtn>
          </>
        )}
      </div>
    </div>
  );
}

export function ScenariosScreen({ onStart }) {
  const [tab, setTab] = React.useState('all');
  const all = AthenaData.scenarios;
  const filtered = tab === 'all' ? all : all.filter((s) => (tab === 'active' ? s.status !== 'available' : s.status === 'available'));

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '0 0 4px' }}>Pick an exercise. Starting a scenario activates its alerts, logs, and endpoints across Athena.</p>
          <ScTabs value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All scenarios', count: all.length }, { id: 'active', label: 'My progress' }, { id: 'available', label: 'Available' }]} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <ScBtn variant="secondary" size="md" leadingIcon={<Icon name="SlidersHorizontal" size={15} />}>Filters</ScBtn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
        {filtered.map((s) => <ScenarioCard key={s.id} s={s} onStart={onStart} />)}
      </div>
    </div>
  );
}

export default ScenariosScreen;
