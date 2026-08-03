'use client';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';

const TYPE_META = {
  DOJO: { tone: 'brand', label: 'Dojo' },
  ASSESSMENT: { tone: 'accent', label: 'Assessment' },
};

/* Scenario authoring index: list + entry to the create form. */
export function ScenariosList({ scenarios }) {
  const router = useRouter();

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>Scenarios</h2>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>{scenarios.length} authored · Dojos and Assessments</p>
        </div>
        <Link href="/admin/scenarios/new" style={{ textDecoration: 'none' }}>
          <AC.Button variant="primary" size="sm" leadingIcon={<Icon name="Plus" size={14} />}>New scenario</AC.Button>
        </Link>
      </div>

      <AC.Card padded={false}>
        {scenarios.length === 0 ? (
          <div style={{ padding: 8 }}>
            <AC.EmptyState
              icon={<Icon name="Boxes" size={24} />}
              title="No scenarios yet"
              description="Author your first Dojo or Assessment scenario."
              actions={<Link href="/admin/scenarios/new" style={{ textDecoration: 'none' }}><AC.Button variant="primary" size="sm">New scenario</AC.Button></Link>}
            />
          </div>
        ) : (
          <AC.Table
            rowKey="id"
            onRowClick={(row) => router.push(`/admin/scenarios/${row.id}`)}
            columns={[
              { key: 'title', header: 'Title', primary: true },
              { key: 'type', header: 'Type', width: '130px', render: (v) => <AC.Badge tone={TYPE_META[v].tone} square>{TYPE_META[v].label}</AC.Badge> },
              { key: 'exposure', header: 'Exposure', width: '110px', render: (v, row) => (
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <AC.Badge tone={v === 'PUBLIC' ? 'success' : 'neutral'} dot square>{v === 'PUBLIC' ? 'Public' : 'Rollout'}</AC.Badge>
                  {row.hidden && <Icon name="EyeOff" size={14} style={{ color: 'var(--text-tertiary)' }} />}
                </span>
              ) },
              { key: 'endpoints', header: 'Endpoints', align: 'right', mono: true, width: '100px' },
              { key: 'updated', header: 'Updated', align: 'right', mono: true, width: '120px' },
            ]}
            rows={scenarios}
          />
        )}
      </AC.Card>
    </div>
  );
}

export default ScenariosList;
