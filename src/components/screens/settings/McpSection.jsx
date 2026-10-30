'use client';
import React, { useState, useTransition } from 'react';
import { Alert, App, Button, Card, Empty, Flex, Form, Input, Modal, Popconfirm, Table, Typography, theme } from 'antd';
import { RobotOutlined, PlusOutlined, DeleteOutlined, CodeOutlined, TagOutlined, KeyOutlined, LinkOutlined } from '@ant-design/icons';
import { createMcpKey, revokeMcpKey } from '@/app/actions/apikeys';
import { SectionHeader, FormLayout } from './parts';

const claudeCode = (url, key) => `claude mcp add --transport http athena ${url} --header "Authorization: Bearer ${key}"`;
const desktopConfig = (url, key) => JSON.stringify({
  mcpServers: {
    athena: {
      command: 'npx',
      args: ['-y', 'mcp-remote', url, '--header', 'Authorization:${ATHENA_AUTH}'],
      env: { ATHENA_AUTH: `Bearer ${key}` },
    },
  },
}, null, 2);

function Snippet({ text }) {
  const { token } = theme.useToken();
  return (
    <Flex align="flex-start" gap={8}>
      <pre style={{ flex: 1, margin: 0, padding: '12px 14px', borderRadius: token.borderRadius, background: token.colorFillQuaternary, fontFamily: token.fontFamilyCode, fontSize: 12.5, color: token.colorTextSecondary, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{text}</pre>
      <Typography.Text copyable={{ text }} />
    </Flex>
  );
}

/* Personal MCP keys (docs/mcp.md). A key acts as the architect who made it on
   /api/mcp: reading scenarios, labs and submissions, grading, and building
   bundles with the auto-builder. Shown once on creation; only the hash is kept. */
export function McpSection({ keys, url }) {
  const { message } = App.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState(null);
  const [creating, startCreate] = useTransition();
  const [revealed, setRevealed] = useState(null); // { name, key }
  const [busyId, setBusyId] = useState(null);

  const onCreate = () => {
    startCreate(async () => {
      const res = await createMcpKey(name);
      if (res?.error) { setCreateError(res.error); return; }
      setName('');
      setCreateError(null);
      setCreateOpen(false);
      setRevealed(res.created);
    });
  };

  const onRevoke = async (k) => {
    setBusyId(k.id);
    const res = await revokeMcpKey(k.id);
    setBusyId(null);
    if (res?.error) message.error(res.error);
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v) => <Typography.Text strong>{v}</Typography.Text> },
    { title: 'Key', dataIndex: 'prefix', key: 'prefix', render: (v) => <Typography.Text code>{v}…</Typography.Text> },
    { title: 'Created', dataIndex: 'created', key: 'created', width: 120 },
    { title: 'Last used', dataIndex: 'lastUsed', key: 'lastUsed', width: 120 },
    {
      title: '', key: 'actions', width: 110, align: 'right',
      render: (_v, row) => (
        <Popconfirm
          title="Revoke this key?"
          description="Clients using it lose access immediately."
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
        title={<SectionHeader icon={<RobotOutlined />} title="MCP keys" subtitle="Connect Claude (or any MCP client) to Athena as you." />}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateError(null); setCreateOpen(true); }}>Generate key</Button>}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={keys}
          pagination={false}
          locale={{ emptyText: <Empty description="No MCP keys yet. Generate one to connect Claude." /> }}
        />
      </Card>

      <Card title={<SectionHeader icon={<LinkOutlined />} title="Server" subtitle="A remote MCP server over Streamable HTTP, authenticated with your key as a Bearer token." />}>
        <Flex vertical gap={12}>
          <Snippet text={url} />
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            The key works only for you, and only while you are an instructor with the architect permission.
            Through it a client can read scenarios, labs, cohorts and submissions, grade submissions and lab
            sessions, and upload bundles to the auto-builder (SOC Dojos and Assessments, and labs). Everything it
            does is recorded as done by you. Treat the key like your password.
          </Typography.Paragraph>
        </Flex>
      </Card>

      <Card title={<SectionHeader icon={<CodeOutlined />} title="Connecting" subtitle="Claude Code, in a terminal:" />}>
        <Flex vertical gap={12}>
          <Snippet text={claudeCode(url, 'athmcp_...')} />
          <Typography.Text type="secondary">Claude Desktop (claude_desktop_config.json), through mcp-remote:</Typography.Text>
          <Snippet text={desktopConfig(url, 'athmcp_...')} />
        </Flex>
      </Card>

      <Modal
        open={createOpen}
        title="Generate MCP key"
        onCancel={() => setCreateOpen(false)}
        destroyOnHidden
        okText="Generate"
        onOk={onCreate}
        okButtonProps={{ icon: <PlusOutlined />, disabled: !name.trim() }}
        confirmLoading={creating}
      >
        <Typography.Paragraph type="secondary">Name it after the client or machine that will use it, so you know which to revoke.</Typography.Paragraph>
        <FormLayout>
          <Form.Item label="Key name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} onPressEnter={() => name.trim() && onCreate()} placeholder="e.g. Claude Code on my laptop" prefix={<TagOutlined />} autoFocus maxLength={80} />
          </Form.Item>
        </FormLayout>
        {createError && <Alert type="error" showIcon title={createError} />}
      </Modal>

      <Modal
        open={!!revealed}
        title={<Flex align="center" gap={8}><KeyOutlined />MCP key created</Flex>}
        onCancel={() => setRevealed(null)}
        destroyOnHidden
        width={680}
        footer={<Button type="primary" onClick={() => setRevealed(null)}>Done</Button>}
      >
        {revealed && (
          <Flex vertical gap={12}>
            <Alert type="warning" showIcon title="Copy this key now. It is shown only once and can't be recovered." />
            <Card size="small" title={revealed.name}>
              <Typography.Text code copyable={{ text: revealed.key, tooltips: ['Copy key', 'Copied'] }} style={{ wordBreak: 'break-all' }}>{revealed.key}</Typography.Text>
            </Card>
            <Typography.Text type="secondary">Claude Code, with this key filled in:</Typography.Text>
            <Snippet text={claudeCode(url, revealed.key)} />
          </Flex>
        )}
      </Modal>
    </Flex>
  );
}

export default McpSection;
