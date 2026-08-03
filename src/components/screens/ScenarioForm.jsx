'use client';
import React, { useActionState } from 'react';
import Link from 'next/link';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { createScenario } from '@/app/actions/scenarios';
import { ScenarioFields } from './scenarios/ScenarioFields';
import { FormStatus } from './settings/parts';

/* New scenario authoring form. On success the action redirects to the new
   scenario's detail page (where endpoints/artifacts are added). */
export function ScenarioForm() {
  const [state, action, saving] = useActionState(createScenario, {});

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/admin/scenarios" style={{ textDecoration: 'none' }}>
          <AC.IconButton label="Back"><Icon name="ArrowLeft" size={18} /></AC.IconButton>
        </Link>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>New scenario</h2>
      </div>

      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ScenarioFields mode="create" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '4px 2px 24px' }}>
          <FormStatus state={state} />
          <Link href="/admin/scenarios" style={{ textDecoration: 'none' }}>
            <AC.Button type="button" variant="ghost">Cancel</AC.Button>
          </Link>
          <AC.Button type="submit" variant="primary" loading={saving} leadingIcon={<Icon name="Check" size={14} />}>Create scenario</AC.Button>
        </div>
      </form>
    </div>
  );
}

export default ScenarioForm;
