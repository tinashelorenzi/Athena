'use client';
import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { setSubmissionCommitted } from '@/app/actions/grading';
import { GradeReviewDialog } from './GradeReviewDialog';

const TYPE_META = { DOJO: { tone: 'brand', label: 'Dojo' }, ASSESSMENT: { tone: 'accent', label: 'Assessment' } };

/* Lifecycle: open (student can re-do) → committed (locked, to grade) →
   held (graded, not released) → released. */
function stateOf(row) {
  if (row.status === 'GRADED') return row.released ? 'released' : 'held';
  return row.committed ? 'committed' : 'open';
}

export function GradingQueue({ items }) {
  const router = useRouter();
  const counts = useMemo(() => {
    const c = { open: 0, committed: 0, held: 0, released: 0 };
    for (const i of items) c[stateOf(i)] += 1;
    return { ...c, all: items.length };
  }, [items]);

  const [tab, setTab] = useState(() => (counts.committed ? 'committed' : counts.open ? 'open' : 'all'));
  const [q, setQ] = useState('');
  const [cohort, setCohort] = useState('');
  const [reviewing, setReviewing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const cohorts = useMemo(() => [...new Set(items.map((i) => i.cohortName))].sort(), [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => {
      if (tab !== 'all' && stateOf(i) !== tab) return false;
      if (cohort && i.cohortName !== cohort) return false;
      if (s && !(`${i.studentName} ${i.scenarioTitle} ${i.cohortName}`.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [items, tab, q, cohort]);

  const commit = async (row) => {
    setBusyId(row.id);
    const res = await setSubmissionCommitted(row.id, true);
    setBusyId(null);
    if (res?.error) { setError(res.error); return; }
    router.refresh();
  };

  const TABS = [
    { id: 'open', label: 'Open', icon: <Icon name="PencilLine" size={15} />, n: counts.open },
    { id: 'committed', label: 'To grade', icon: <Icon name="Inbox" size={15} />, n: counts.committed },
    { id: 'held', label: 'Held', icon: <Icon name="EyeOff" size={15} />, n: counts.held },
    { id: 'released', label: 'Released', icon: <Icon name="CircleCheck" size={15} />, n: counts.released },
    { id: 'all', label: 'All', icon: <Icon name="List" size={15} />, n: counts.all },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>Grading queue</h2>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>Students can keep re-doing an assessment until you <strong style={{ color: 'var(--text-secondary)' }}>commit</strong> it. Committing locks it for grading; then grade, amend, and release.</p>
      </div>

      {error && <AC.Toast tone="danger" title="Something went wrong" message={error} onClose={() => setError(null)} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <AC.StatCard label="Open" value={String(counts.open)} tone={counts.open ? 'accent' : 'default'} icon={<Icon name="PencilLine" size={16} />} hint="Student can still re-do" />
        <AC.StatCard label="To grade" value={String(counts.committed)} tone={counts.committed ? 'warning' : 'default'} icon={<Icon name="Inbox" size={16} />} hint="Committed, awaiting a grade" />
        <AC.StatCard label="Held" value={String(counts.held)} icon={<Icon name="EyeOff" size={16} />} hint="Graded, not released" />
        <AC.StatCard label="Released" value={String(counts.released)} icon={<Icon name="CircleCheck" size={16} />} hint="Visible to students" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <AC.Tabs
          tabs={TABS.map((t) => ({ id: t.id, label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>{t.icon}{t.label}<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{t.n}</span></span> }))}
          value={tab}
          onChange={setTab}
        />
        <div style={{ flex: 1 }} />
        <div style={{ width: 180 }}>
          <AC.Select size="sm" value={cohort} onChange={(e) => setCohort(e.target.value)} options={[{ value: '', label: 'All cohorts' }, ...cohorts.map((c) => ({ value: c, label: c }))]} />
        </div>
        <div style={{ width: 220 }}>
          <AC.Input size="sm" placeholder="Search student / scenario…" value={q} onChange={(e) => setQ(e.target.value)} leadingIcon={<Icon name="Search" size={15} />} />
        </div>
      </div>

      <AC.Card padded={false}>
        {filtered.length === 0 ? (
          <div style={{ padding: 8 }}>
            <AC.EmptyState icon={<Icon name="Inbox" size={22} />} title="Nothing here" description={tab === 'open' ? 'No submissions are open for re-do.' : tab === 'committed' ? 'No committed submissions are waiting to be graded.' : tab === 'held' ? 'No graded submissions are being held.' : 'No submissions match.'} />
          </div>
        ) : (
          <AC.Table
            rowKey="id"
            hover
            onRowClick={(row) => setReviewing(row)}
            columns={[
              { key: 'studentName', header: 'Student', primary: true },
              { key: 'cohortName', header: 'Cohort', width: '150px' },
              { key: 'scenarioTitle', header: 'Scenario', render: (v, row) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{v}<AC.Badge tone={TYPE_META[row.scenarioType]?.tone || 'neutral'} square>{TYPE_META[row.scenarioType]?.label}</AC.Badge></span>
              ) },
              { key: 'flagsTotal', header: 'Flags', width: '80px', align: 'center', mono: true, render: (_v, row) => (row.flagsTotal ? `${row.flagsCorrect}/${row.flagsTotal}` : '—') },
              { key: 'autoGrade', header: 'Auto', width: '70px', align: 'center', mono: true, render: (v) => (v == null ? '—' : v) },
              { key: 'submitted', header: 'Submitted', width: '110px', mono: true, render: (v) => v.slice(0, 10) },
              { key: 'status', header: 'State', width: '140px', render: (_v, row) => {
                const st = stateOf(row);
                if (st === 'open') return <AC.Badge tone="neutral" dot square>Open</AC.Badge>;
                if (st === 'committed') return <AC.Badge tone="warning" dot square>To grade</AC.Badge>;
                if (st === 'held') return <AC.Badge tone="accent" dot square>Held · {row.grade ?? '—'}</AC.Badge>;
                return <AC.Badge tone="success" dot square>Released · {row.grade ?? '—'}</AC.Badge>;
              } },
              { key: 'id', header: '', align: 'right', width: '120px', render: (_v, row) => {
                const st = stateOf(row);
                if (st === 'open') {
                  return <AC.Button variant="primary" size="sm" loading={busyId === row.id} leadingIcon={<Icon name="Lock" size={13} />} onClick={(e) => { e.stopPropagation(); commit(row); }}>Commit</AC.Button>;
                }
                return <AC.Button variant="secondary" size="sm" leadingIcon={<Icon name="PenLine" size={14} />} onClick={(e) => { e.stopPropagation(); setReviewing(row); }}>{st === 'committed' ? 'Grade' : 'Review'}</AC.Button>;
              } },
            ]}
            rows={filtered}
          />
        )}
      </AC.Card>

      <GradeReviewDialog
        key={reviewing?.id || 'none'}
        submission={reviewing}
        onClose={() => setReviewing(null)}
        onError={setError}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

export default GradingQueue;
