'use client';
import React, { useState, useActionState, useTransition } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { saveStorageSettings, testStorageConnection } from '@/app/actions/settings';
import { SectionHeader, FormStatus, ToggleRow } from './parts';

/* Object storage (S3 or MinIO) used for scenario artifact (evidence zip)
   uploads. Credentials are stored encrypted; the secret is never sent back. */
export function StorageSection({ storage }) {
  const [state, action, saving] = useActionState(saveStorageSettings, {});
  const [provider, setProvider] = useState(storage.provider);
  const [forcePathStyle, setForcePathStyle] = useState(storage.forcePathStyle);

  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState(null);

  const runTest = () => {
    setTestResult(null);
    startTest(async () => setTestResult(await testStorageConnection()));
  };

  const isMinio = provider === 'minio';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <AC.Card header={<SectionHeader icon="Database" title="Storage" subtitle="S3 or MinIO bucket for uploaded evidence artifacts." />}>
        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AC.Select
            label="Provider"
            name="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            options={[{ value: 's3', label: 'Amazon S3' }, { value: 'minio', label: 'MinIO / S3-compatible' }]}
          />

          <AC.Input
            label={isMinio ? 'Endpoint (required)' : 'Endpoint (optional)'}
            name="endpoint"
            defaultValue={storage.endpoint}
            placeholder={isMinio ? 'http://localhost:9000' : 'leave blank for AWS'}
            mono
            leadingIcon={<Icon name="Link" size={16} />}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <AC.Input label="Bucket" name="bucket" defaultValue={storage.bucket} placeholder="athena-artifacts" mono leadingIcon={<Icon name="Package" size={16} />} />
            <AC.Input label="Region" name="region" defaultValue={storage.region} placeholder="us-east-1" mono />
          </div>

          <AC.Input label="Access key ID" name="accessKeyId" defaultValue={storage.accessKeyId} mono leadingIcon={<Icon name="KeyRound" size={16} />} />
          <AC.Input
            label="Secret access key"
            name="secretAccessKey"
            type="password"
            autoComplete="off"
            placeholder={storage.secretConfigured ? '•••••••••••• (configured — leave blank to keep)' : 'Secret access key'}
            mono
            leadingIcon={<Icon name="KeyRound" size={16} />}
            hint="Stored encrypted. Leave blank to keep the current value."
          />

          <ToggleRow label="Force path-style URLs" hint="Required for MinIO and most S3-compatible services." checked={forcePathStyle}>
            <AC.Switch checked={forcePathStyle} onChange={() => setForcePathStyle((v) => !v)} />
          </ToggleRow>
          <input type="hidden" name="forcePathStyle" value={forcePathStyle ? 'on' : ''} />

          <FormStatus state={state} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <AC.Button type="button" variant="secondary" loading={testing} leadingIcon={<Icon name="PlugZap" size={14} />} onClick={runTest}>Test connection</AC.Button>
            <AC.Button type="submit" variant="primary" loading={saving} leadingIcon={<Icon name="Check" size={14} />}>Save storage</AC.Button>
          </div>
          {testResult && <FormStatus state={testResult} />}
        </form>
      </AC.Card>
    </div>
  );
}

export default StorageSection;
