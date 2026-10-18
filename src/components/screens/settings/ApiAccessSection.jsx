'use client';
import React, { useState, useTransition } from 'react';
import { Alert, App, Button, Card, Empty, Flex, Form, Input, Modal, Popconfirm, Table, Typography, theme } from 'antd';
import { ApiOutlined, PlusOutlined, DeleteOutlined, CodeOutlined, TagOutlined, KeyOutlined } from '@ant-design/icons';
import { createApiKey, revokeApiKey } from '@/app/actions/apikeys';
import { SectionHeader, FormLayout } from './parts';

const CURL = `curl -H "Authorization: Bearer ath_..." \\
  https://<your-athena-host>/api/v1/ping`;

/* API key management. Keys are shown once on creation; only their hash is
   stored. They authenticate requests to /api/v1/* (see GET /api/v1/ping). */
export function ApiAccessSection({ apiKeys }) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [creating, startCreate] = useTransition();
  const [revealed, setRevealed] = useState(null); // { name, key }
  const [busyId, setBusyId] = useState(null);

  const openCreate = () => { setCreateError(null); setCreateOpen(true); };

  const onCreateSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startCreate(async () => {
      const res = await createApiKey({}, formData);
      if (res?.error) { setCreateError(res.error); return; }
      form.reset();
      setCreateError(null);
      setCreateOpen(false);
      setRevealed(res.created);
    });
  };

  const onRevoke = async (k) => {
    setBusyId(k.id);
    const res = await revokeApiKey(k.id);
    setBusyId(null);
    if (res?.error) message.error(res.error);
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v) => <Typography.Text strong>{v}</Typography.Text> },
    { title: 'Key', dataIndex: 'prefix', key: 'prefix', render: (v) => <Typography.Text code>{v}…</Typography.Text> },
    { title: 'Created', dataIndex: 'created', key: 'created', width: 120, sorter: (a, b) => a.created.localeCompare(b.created) },
    { title: 'Last used', dataIndex: 'lastUsed', key: 'lastUsed', width: 120 },
    {
      title: '', key: 'actions', width: 110, align: 'right',
      render: (_v, row) => (
        <Popconfirm
          title="Revoke this key?"
          description="Integrations using it will stop working immediately."
          okText="Revoke"
          okButtonProps={{ danger: true }}
          onConfirm={() => onRevoke(row)}
        >
          <Button danger size="small" loading={busyId === row.id} icon={<DeleteOutlined />}>Revoke</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Card
        title={<SectionHeader icon={<ApiOutlined />} title="API keys" subtitle="Let other applications integrate with Athena." />}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Generate key</Button>}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={apiKeys}
          pagination={false}
          locale={{ emptyText: <Empty description="No API keys — generate one to let an external app call the Athena API." /> }}
        />
      </Card>

      <Card title={<SectionHeader icon={<CodeOutlined />} title="Using a key" subtitle="Send it as a Bearer token." />}>
        <Flex align="flex-start" gap={8}>
          <pre style={{ flex: 1, margin: 0, padding: '12px 14px', borderRadius: token.borderRadius, background: token.colorFillQuaternary, fontFamily: token.fontFamilyCode, fontSize: 12.5, color: token.colorTextSecondary, overflow: 'auto' }}>{CURL}</pre>
          <Typography.Text copyable={{ text: CURL }} />
        </Flex>
      </Card>

      {/* Generate dialog */}
      <Modal
        open={createOpen}
        title="Generate API key"
        onCancel={() => setCreateOpen(false)}
        destroyOnHidden
        okText="Generate"
        okButtonProps={{ htmlType: 'submit', form: 'api-key-create', icon: <PlusOutlined /> }}
        confirmLoading={creating}
      >
        <Typography.Paragraph type="secondary">Name the key so you know which integration it belongs to.</Typography.Paragraph>
        <form id="api-key-create" onSubmit={onCreateSubmit}>
          <FormLayout>
            <Form.Item label="Key name" required>
              <Input name="name" placeholder="e.g. Grafana integration" required prefix={<TagOutlined />} autoFocus />
            </Form.Item>
          </FormLayout>
          {createError && <Alert type="error" showIcon title={createError} />}
        </form>
      </Modal>

      {/* Reveal-once dialog */}
      <Modal
        open={!!revealed}
        title={<Flex align="center" gap={8}><KeyOutlined />API key created</Flex>}
        onCancel={() => setRevealed(null)}
        destroyOnHidden
        footer={<Button type="primary" onClick={() => setRevealed(null)}>Done</Button>}
      >
        {revealed && (
          <Flex vertical gap={12}>
            <Alert type="warning" showIcon title="Copy this key now — it is shown only once and cannot be recovered." />
            <Card size="small" title={revealed.name}>
              <Typography.Text code copyable={{ text: revealed.key, tooltips: ['Copy key', 'Copied'] }} style={{ wordBreak: 'break-all' }}>{revealed.key}</Typography.Text>
            </Card>
          </Flex>
        )}
      </Modal>
    </Flex>
  );
}

export default ApiAccessSection;
