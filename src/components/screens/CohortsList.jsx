'use client';
import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { createCohort } from '@/app/actions/cohorts';

export function CohortsList({ cohorts }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [creating, startCreate] = useTransition();

  const submit = () => {
    setError(null);
    startCreate(async () => {
      const res = await createCohort(name);
      if (res?.error) { setError(res.error); return; }
      setOpen(false);
      setName('');
      router.push(`/admin/cohorts/${res.cohort.id}`);
    });
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>Cohorts</h2>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>{cohorts.length} {cohorts.length === 1 ? 'cohort' : 'cohorts'} · groups of students</p>
        </div>
        <AC.Button variant="primary" size="sm" leadingIcon={<Icon name="Plus" size={14} />} onClick={() => { setError(null); setName(''); setOpen(true); }}>New cohort</AC.Button>
      </div>

      <AC.Card padded={false}>
        {cohorts.length === 0 ? (
          <div style={{ padding: 8 }}>
            <AC.EmptyState icon={<Icon name="GraduationCap" size={24} />} title="No cohorts yet" description="Create a cohort, then add or invite students into it." actions={<AC.Button variant="primary" size="sm" onClick={() => setOpen(true)}>New cohort</AC.Button>} />
          </div>
        ) : (
          <AC.Table
            rowKey="id"
            onRowClick={(row) => router.push(`/admin/cohorts/${row.id}`)}
            columns={[
              { key: 'name', header: 'Cohort', primary: true },
              { key: 'students', header: 'Students', align: 'right', mono: true, width: '110px' },
              { key: 'scenarios', header: 'Scenarios', align: 'right', mono: true, width: '110px' },
              { key: 'created', header: 'Created', align: 'right', mono: true, width: '120px' },
            ]}
            rows={cohorts}
          />
        )}
      </AC.Card>

      <AC.Dialog
        open={open}
        title="New cohort"
        description="Name the class or group (e.g. “Cyber Bootcamp — Sept 2026”)."
        icon={<Icon name="GraduationCap" size={18} />}
        onClose={() => setOpen(false)}
        footer={
          <>
            <AC.Button variant="ghost" onClick={() => setOpen(false)}>Cancel</AC.Button>
            <AC.Button variant="primary" loading={creating} onClick={submit}>Create cohort</AC.Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <AC.Input label="Cohort name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cyber Bootcamp — Sept 2026" leadingIcon={<Icon name="GraduationCap" size={16} />} />
          {error && <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--status-danger, #ef4444)' }}><Icon name="TriangleAlert" size={15} /> {error}</div>}
        </div>
      </AC.Dialog>
    </div>
  );
}

export default CohortsList;
