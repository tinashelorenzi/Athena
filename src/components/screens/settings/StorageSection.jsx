'use client';
import React, { useState, useActionState, useTransition } from 'react';
import { Button, Card, Col, Flex, Input, Row, Select, Switch } from 'antd';
import { DatabaseOutlined, LinkOutlined, InboxOutlined, KeyOutlined, ApiOutlined, CheckOutlined } from '@ant-design/icons';
import { saveStorageSettings, testStorageConnection } from '@/app/actions/settings';
import { Field } from '../scenarios/primitives';
import { SectionHeader, FormStatus, ToggleRow, FormLayout } from './parts';

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
    <Card title={<SectionHeader icon={<DatabaseOutlined />} title="Storage" subtitle="S3 or MinIO bucket for uploaded evidence artifacts." />}>
      <form action={action}>
        <FormLayout>
          <Field label="Provider">
            <Select
              value={provider}
              onChange={setProvider}
              options={[{ value: 's3', label: 'Amazon S3' }, { value: 'minio', label: 'MinIO / S3-compatible' }]}
            />
          </Field>
          <input type="hidden" name="provider" value={provider} />

          <Field label={isMinio ? 'Endpoint' : 'Endpoint (optional)'} required={isMinio}>
            <Input name="endpoint" defaultValue={storage.endpoint} placeholder={isMinio ? 'http://localhost:9000' : 'leave blank for AWS'} prefix={<LinkOutlined />} />
          </Field>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Field label="Bucket"><Input name="bucket" defaultValue={storage.bucket} placeholder="athena-artifacts" prefix={<InboxOutlined />} /></Field>
            </Col>
            <Col xs={24} md={12}>
              <Field label="Region"><Input name="region" defaultValue={storage.region} placeholder="us-east-1" /></Field>
            </Col>
          </Row>

          <Field label="Access key ID">
            <Input name="accessKeyId" defaultValue={storage.accessKeyId} prefix={<KeyOutlined />} />
          </Field>
          <Field label="Secret access key" hint="Stored encrypted. Leave blank to keep the current value.">
            <Input.Password
              name="secretAccessKey"
              autoComplete="off"
              placeholder={storage.secretConfigured ? '•••••••••••• (configured — leave blank to keep)' : 'Secret access key'}
              prefix={<KeyOutlined />}
            />
          </Field>

          <ToggleRow label="Force path-style URLs" hint="Required for MinIO and most S3-compatible services.">
            <Switch checked={forcePathStyle} onChange={setForcePathStyle} />
          </ToggleRow>
          <input type="hidden" name="forcePathStyle" value={forcePathStyle ? 'on' : ''} />

          <Flex vertical gap={12}>
            <FormStatus state={state} />
            <Flex justify="flex-end" gap={8}>
              <Button loading={testing} icon={<ApiOutlined />} onClick={runTest}>Test connection</Button>
              <Button type="primary" htmlType="submit" loading={saving} icon={<CheckOutlined />}>Save storage</Button>
            </Flex>
            <FormStatus state={testResult} />
          </Flex>
        </FormLayout>
      </form>
    </Card>
  );
}

export default StorageSection;
