'use client';
import React, { useState, useActionState } from 'react';
import Link from 'next/link';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { updateScenarioBasics, deleteScenario, saveEndpoint, removeEndpoint } from '@/app/actions/scenarios';
import { ScenarioFields, Field } from './scenarios/ScenarioFields';
import { JsonField } from './scenarios/JsonField';
import { FormStatus } from './settings/parts';

const TYPE_META = { DOJO: { tone: 'brand', label: 'Dojo' }, ASSESSMENT: { tone: 'accent', label: 'Assessment' } };

export function ScenarioEditor({ scenario, endpoints }) {
  const [state, action, saving] = useActionState(updateScenarioBasics.bind(null, scenario.id), {});
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState(null);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/admin/scenarios" style={{ textDecoration: 'none' }}>
          <AC.IconButton label="Back"><Icon name="ArrowLeft" size={18} /></AC.IconButton>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{scenario.title}</h2>
            <AC.Badge tone={TYPE_META[scenario.type].tone} square>{TYPE_META[scenario.type].label}</AC.Badge>
            {scenario.hidden && <AC.Badge tone="neutral" square icon={<Icon name="EyeOff" size={11} />}>Hidden</AC.Badge>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{scenario.id}</div>
        </div>
        <AC.Button variant="outline-danger" size="sm" leadingIcon={<Icon name="Trash2" size={14} />} onClick={() => setConfirmDel(true)}>Delete</AC.Button>
      </div>

      {error && <AC.Toast tone="danger" title="Something went wrong" message={error} onClose={() => setError(null)} />}

      {scenario.refToken && <ReferenceLink token={scenario.refToken} />}

      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ScenarioFields mode="edit" initial={scenario} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          <FormStatus state={state} />
          <AC.Button type="submit" variant="primary" loading={saving} leadingIcon={<Icon name="Check" size={14} />}>Save changes</AC.Button>
        </div>
      </form>

      {/* Raw data status */}
      <AC.Card header={<HeaderRow icon="Database" title="SOC data bundles" subtitle="Set at creation." />}>
        <div style={{ display: 'flex', gap: 10 }}>
          <AC.Badge tone={scenario.hasLogs ? 'success' : 'neutral'} dot square>Logs {scenario.hasLogs ? 'present' : 'none'}</AC.Badge>
          <AC.Badge tone={scenario.hasAlerts ? 'success' : 'neutral'} dot square>Alerts {scenario.hasAlerts ? 'present' : 'none'}</AC.Badge>
        </div>
      </AC.Card>

      <EndpointsManager scenarioId={scenario.id} endpoints={endpoints} onError={setError} />

      <AC.Dialog
        open={confirmDel}
        title="Delete scenario?"
        description={`"${scenario.title}" and all its endpoints/artifacts will be permanently removed.`}
        icon={<Icon name="Trash2" size={18} />}
        onClose={() => setConfirmDel(false)}
        footer={
          <>
            <AC.Button variant="ghost" onClick={() => setConfirmDel(false)}>Cancel</AC.Button>
            <AC.Button variant="danger" leadingIcon={<Icon name="Trash2" size={14} />} onClick={() => { setConfirmDel(false); deleteScenario(scenario.id); }}>Delete scenario</AC.Button>
          </>
        }
      />
    </div>
  );
}

function EndpointsManager({ scenarioId, endpoints, onError }) {
  const [state, action, saving] = useActionState(saveEndpoint.bind(null, scenarioId), {});
  const [busyId, setBusyId] = useState(null);

  const onRemove = async (ep) => {
    setBusyId(ep.id);
    const res = await removeEndpoint(ep.id);
    setBusyId(null);
    if (res?.error) onError(res.error);
  };

  return (
    <AC.Card header={<HeaderRow icon="MonitorSmartphone" title="Endpoints" subtitle="EDR + OSQuery data and evidence artifacts, per host." />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {endpoints.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No endpoints yet. Add one below.</div>
        ) : (
          endpoints.map((ep) => (
            <div key={ep.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-inset)', border: '1px solid var(--border-default)' }}>
              <Icon name="Server" size={16} style={{ color: 'var(--text-secondary)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>{ep.hostname}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <AC.Badge tone={ep.hasEdr ? 'success' : 'neutral'} dot square>EDR</AC.Badge>
                  <AC.Badge tone={ep.hasOsquery ? 'success' : 'neutral'} dot square>OSQuery</AC.Badge>
                  {ep.artifactName && <AC.Badge tone="brand" square icon={<Icon name="Paperclip" size={11} />}>{ep.artifactName}</AC.Badge>}
                </div>
              </div>
              <AC.IconButton label="Remove endpoint" disabled={busyId === ep.id} onClick={() => onRemove(ep)}><Icon name="Trash2" size={15} /></AC.IconButton>
            </div>
          ))
        )}
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '16px 0' }} />

      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Add / update endpoint</div>
        <AC.Input label="Hostname" name="hostname" required placeholder="win-ep-04" mono leadingIcon={<Icon name="Server" size={16} />} />
        <JsonField label="EDR sample (JSON)" name="edr" example="edr" rows={4} placeholder='{ "hostname": "win-ep-04", "processes": [] }' />
        <JsonField label="OSQuery data (JSON)" name="osquery" example="osquery" rows={4} placeholder='{ "hostname": "win-ep-04", "tables": {} }' />
        <Field label="Evidence artifact (ZIP, optional)" hint="Requires object storage configured in Settings → Storage.">
          <input type="file" name="artifact" accept=".zip,application/zip" style={{ fontSize: 12, color: 'var(--text-tertiary)' }} />
        </Field>
        <FormStatus state={state} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <AC.Button type="submit" variant="secondary" loading={saving} leadingIcon={<Icon name="Plus" size={14} />}>Save endpoint</AC.Button>
        </div>
      </form>
    </AC.Card>
  );
}

function ReferenceLink({ token }) {
  const [copied, setCopied] = useState(false);
  const path = `/s/${token}`;
  const copy = async () => {
    try {
      const url = (typeof window !== 'undefined' ? window.location.origin : '') + path;
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch { /* clipboard blocked */ }
  };
  return (
    <AC.Card header={<HeaderRow icon="Link" title="Reference link" subtitle="Embed in the LMS / learning materials — students land straight in this scenario." />}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <code style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)', background: 'var(--surface-inset)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{path}</code>
        <AC.Button variant="secondary" size="sm" leadingIcon={<Icon name={copied ? 'Check' : 'Copy'} size={14} />} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</AC.Button>
      </div>
    </AC.Card>
  );
}

function HeaderRow({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Icon name={icon} size={16} style={{ color: 'var(--text-secondary)' }} />
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{subtitle}</div>}
      </div>
    </div>
  );
}

export default ScenarioEditor;
