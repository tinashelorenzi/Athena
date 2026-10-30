'use client';
import React, { useActionState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, App, Badge, Button, Card, Empty, Flex, Popconfirm, Table, Tag, Tooltip, Typography,
} from 'antd';
import { CloudServerOutlined, DeleteOutlined, KeyOutlined, PlusOutlined } from '@ant-design/icons';
import { generateEnrollCode, removeMachine, renameMachine } from '@/app/actions/machines';
import { useNow, useOrigin } from './clock';

const { Title, Text, Paragraph } = Typography;

function ago(iso, now) {
  if (!iso || now == null) return '';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/* The signed-in user's lab machines: enrol a new one with a one-time code,
   rename or remove existing ones. Refreshes itself so a machine shows up
   (and goes online/offline) without reloading. */
export function MachinesScreen({ machines, email }) {
  const router = useRouter();
  const origin = useOrigin();
  const now = useNow();
  const [codeState, issueCode, issuing] = useActionState(generateEnrollCode, {});
  // A code is "used" once a machine enrolled after it was issued (codes live 10 minutes).
  const issuedAt = codeState.expiresAt ? new Date(codeState.expiresAt).getTime() - 10 * 60 * 1000 : null;
  const linked = issuedAt != null ? machines.find((m) => new Date(m.enrolledAt).getTime() >= issuedAt) : null;
  const codeLive = Boolean(codeState.code && !linked && now != null && new Date(codeState.expiresAt).getTime() > now);

  // Poll faster while a code is waiting to be used, so the new machine pops in.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), codeLive ? 3000 : 15000);
    return () => clearInterval(t);
  }, [router, codeLive]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>Machines</Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0', maxWidth: 760 }}>
          The virtual machines you do Labs on. Each one runs the Athena agent (<Text code>zaio</Text>), which
          collects evidence from the machine when you start and finish a lab. You can link several machines.
        </Paragraph>
      </div>

      <Card title={<Flex gap={8} align="center"><PlusOutlined />Add a machine</Flex>}>
        <ol style={{ margin: 0, paddingInlineStart: 20, listStyle: 'decimal', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <li>
            <Text>
              Install <Text strong>Ubuntu Server 22.04 or 24.04</Text>, or use your <Text strong>Kali Linux</Text> machine, in VirtualBox (or UTM on a Mac),
              with networking that can reach Athena. Each lab says which it needs.
            </Text>
          </li>
          <li>
            <Flex vertical gap={6} align="flex-start">
              <Text>Sign in on the machine and type this. It installs the agent, then asks for your Athena email and a code:</Text>
              <Text code copyable style={{ fontSize: 14 }}>{origin ? `curl -fsSL ${origin}/i | sudo bash` : 'curl -fsSL <athena>/i | sudo bash'}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Agent already installed? Run <Text code style={{ fontSize: 12 }}>sudo zaio setup</Text> instead.
              </Text>
            </Flex>
          </li>
          <li>
            <Flex vertical gap={6} align="flex-start">
              <Text>When it asks for the code, generate one here (it&apos;s valid for 10 minutes):</Text>
              <form action={issueCode}>
                <Button htmlType="submit" type={codeLive ? 'default' : 'primary'} icon={<KeyOutlined />} loading={issuing}>
                  {codeLive ? 'Generate a new code' : 'Generate code'}
                </Button>
              </form>
              {codeLive && <EnrollCode code={codeState.code} expiresAt={codeState.expiresAt} now={now} email={email} />}
              {linked && (
                <Alert type="success" showIcon title={`${linked.label} is linked. It shows below as soon as its agent checks in.`} />
              )}
              {codeState.code && !linked && !codeLive && now != null && (
                <Text type="secondary">Your last code expired. Generate a new one.</Text>
              )}
            </Flex>
          </li>
        </ol>
      </Card>

      <Card title={<Flex gap={8} align="center"><CloudServerOutlined />Your machines</Flex>} styles={{ body: { padding: machines.length ? 0 : 24 } }}>
        {machines.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No machines yet. Add one above." />
        ) : (
          <MachineTable machines={machines} now={now} />
        )}
      </Card>
    </div>
  );
}

/* Quote for a POSIX shell only when needed (emails may contain + or '). */
const shellArg = (s) => (/^[A-Za-z0-9._%+@=:,/-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

function EnrollCode({ code, expiresAt, now, email }) {
  const origin = useOrigin();
  const left = Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000));
  // For machines you can paste into (SSH): everything in one line, no prompts.
  const oneLine = `curl -fsSL ${origin}/i | sudo bash -s -- --email ${shellArg(email)} --code ${code}`;
  return (
    <Alert
      type="info"
      showIcon={false}
      style={{ width: '100%' }}
      title={
        <Flex vertical gap={8}>
          <Flex align="baseline" gap={12} wrap>
            <Text style={{ fontFamily: 'var(--ath-font-family-code)', fontSize: 28, fontWeight: 600, letterSpacing: 2 }} copyable={{ text: code }}>
              {code}
            </Text>
            <Text type="secondary">
              Single use · expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
            </Text>
          </Flex>
          <Text>When the machine asks, enter your email <Text strong>{email}</Text> and this code.</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>Can paste into the machine (e.g. over SSH)? This does it in one go:</Text>
          <Text code copyable style={{ fontSize: 12 }}>{oneLine}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>This page updates by itself once the machine is linked.</Text>
        </Flex>
      }
    />
  );
}

function MachineTable({ machines, now }) {
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();

  const rename = (id, label) => startTransition(async () => {
    const res = await renameMachine(id, label);
    if (res.error) message.error(res.error);
  });
  const remove = (id) => startTransition(async () => {
    const res = await removeMachine(id);
    if (res.error) message.error(res.error); else message.success('Machine removed');
  });

  return (
    <Table
      rowKey="id"
      size="middle"
      pagination={false}
      loading={pending}
      dataSource={machines}
      scroll={{ x: 820 }}
      columns={[
        {
          title: 'Machine', dataIndex: 'label',
          render: (v, m) => (
            <Flex vertical gap={2}>
              <Text strong editable={{ onChange: (next) => next.trim() && next !== v && rename(m.id, next), maxLength: 40, triggerType: ['icon'] }}>{v}</Text>
              <Text type="secondary" style={{ fontSize: 12, fontFamily: 'var(--ath-font-family-code)' }}>{m.hostname}</Text>
            </Flex>
          ),
        },
        {
          title: 'Status', key: 'status', width: 170,
          render: (_, m) => (
            <Flex vertical gap={2}>
              <Badge status={m.online ? 'success' : 'default'} text={m.online ? 'Online' : 'Offline'} />
              {m.lastSeenAt && now != null && <Text type="secondary" style={{ fontSize: 12 }}>seen {ago(m.lastSeenAt, now)}</Text>}
            </Flex>
          ),
        },
        {
          title: 'System', key: 'os', width: 220,
          render: (_, m) => (
            <Flex vertical gap={2}>
              <Text>{m.os}</Text>
              <Flex gap={4}>
                <Tag style={{ margin: 0 }}>{m.arch}</Tag>
                <Tag style={{ margin: 0 }}>agent {m.agentVersion}</Tag>
              </Flex>
            </Flex>
          ),
        },
        {
          title: 'Key', dataIndex: 'keyFingerprint', width: 150,
          render: (v) => (
            <Tooltip title={v}>
              <Text code style={{ fontSize: 12 }} copyable={{ text: v }}>{v.slice(7, 17)}…</Text>
            </Tooltip>
          ),
        },
        {
          title: 'Linked', dataIndex: 'enrolledAt', width: 130,
          render: (v) => <Text type="secondary">{new Date(v).toLocaleDateString()}</Text>,
        },
        {
          key: 'actions', width: 60, align: 'right',
          render: (_, m) => (
            <Popconfirm
              title="Remove this machine?"
              description="Its agent will be refused. Run setup again to re-link it."
              okText="Remove"
              okButtonProps={{ danger: true }}
              onConfirm={() => remove(m.id)}
            >
              <Button type="text" danger aria-label={`Remove ${m.label}`} icon={<DeleteOutlined />} />
            </Popconfirm>
          ),
        },
      ]}
    />
  );
}

export default MachinesScreen;
