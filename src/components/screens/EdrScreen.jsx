'use client';
import React from 'react';
import { Card, Tabs, Table, Tag, List, Avatar, Button, Flex, Space, Typography, Badge, theme } from 'antd';
import { DesktopOutlined, CameraOutlined, StopOutlined, WarningFilled, GlobalOutlined, CodeOutlined, ApartmentOutlined, ClusterOutlined } from '@ant-design/icons';
import * as ED from '@/components/ds';
import { AthenaData } from '@/lib/data';

/* EDR — endpoint detail: processes, network, files, browser & shell history. */
const FLAG_COLOR = { malicious: 'error', suspicious: 'warning', c2: 'error', dns: 'warning', smb: 'default' };

function Mono({ children, style }) {
  const { token } = theme.useToken();
  return <span style={{ fontFamily: token.fontFamilyCode, fontSize: 12.5, ...style }}>{children}</span>;
}

function TabLabel({ icon, label, count }) {
  return (
    <Space size={6}>
      {icon}{label}
      {count != null && <Badge count={count} overflowCount={999} color="default" showZero style={{ boxShadow: 'none' }} />}
    </Space>
  );
}

export function EdrScreen() {
  const { token } = theme.useToken();
  const [tab, setTab] = React.useState('processes');
  const d = AthenaData;

  const processColumns = [
    { key: 'name', dataIndex: 'name', title: 'Process', render: (v, r) => <Space size={7}>{r.susp && <WarningFilled style={{ color: token.colorError }} />}<Mono style={{ fontWeight: 500 }}>{v}</Mono></Space> },
    { key: 'pid', dataIndex: 'pid', title: 'PID', width: 80, render: (v) => <Mono>{v}</Mono> },
    { key: 'parent', dataIndex: 'parent', title: 'Parent', width: 140, render: (v) => <Mono>{v}</Mono> },
    { key: 'user', dataIndex: 'user', title: 'User', width: 110, render: (v) => <Mono>{v}</Mono> },
    { key: 'cpu', dataIndex: 'cpu', title: 'CPU %', width: 90, align: 'right', render: (v) => <Mono>{v}</Mono> },
    { key: 'mem', dataIndex: 'mem', title: 'Mem MB', width: 100, align: 'right', render: (v) => <Mono>{v}</Mono> },
    { key: 'cmd', title: '', width: 120, render: (_, r) => (r.susp ? <Tag color="error">Suspicious</Tag> : null) },
  ];

  const networkColumns = [
    { key: 'proto', dataIndex: 'proto', title: 'Proto', width: 80, render: (v) => <Mono>{v}</Mono> },
    { key: 'laddr', dataIndex: 'laddr', title: 'Local address', render: (v) => <Mono>{v}</Mono> },
    { key: 'raddr', dataIndex: 'raddr', title: 'Remote address', render: (v) => <Mono style={{ fontWeight: 500, color: token.colorText }}>{v}</Mono> },
    { key: 'state', dataIndex: 'state', title: 'State', width: 140, render: (v) => <Mono>{v}</Mono> },
    { key: 'proc', dataIndex: 'proc', title: 'Process', render: (v) => <Mono>{v}</Mono> },
    { key: 'flag', dataIndex: 'flag', title: '', width: 110, render: (v) => (v ? <Tag color={FLAG_COLOR[v] || 'default'}>{v.toUpperCase()}</Tag> : null) },
  ];

  const items = [
    {
      key: 'processes',
      label: <TabLabel icon={<ApartmentOutlined />} label="Processes" count={214} />,
      children: <Table size="small" rowKey="pid" pagination={false} scroll={{ x: 'max-content' }} columns={processColumns} dataSource={d.processes} />,
    },
    {
      key: 'network',
      label: <TabLabel icon={<ClusterOutlined />} label="Network" count={38} />,
      children: <Table size="small" rowKey="laddr" pagination={false} scroll={{ x: 'max-content' }} columns={networkColumns} dataSource={d.connections} />,
    },
    {
      key: 'browser',
      label: <TabLabel icon={<GlobalOutlined />} label="Browser history" />,
      children: (
        <List
          dataSource={d.browserHistory}
          renderItem={(h) => (
            <List.Item actions={h.flag ? [<Tag key="flag" color={FLAG_COLOR[h.flag]}>{h.flag}</Tag>] : undefined}>
              <List.Item.Meta
                avatar={<Mono style={{ color: token.colorTextTertiary, display: 'inline-block', width: 56 }}>{h.t}</Mono>}
                title={h.title}
                description={<Typography.Text type="secondary" ellipsis style={{ fontFamily: token.fontFamilyCode, fontSize: 12, maxWidth: 640 }}>{h.url}</Typography.Text>}
              />
            </List.Item>
          )}
        />
      ),
    },
    {
      key: 'shell',
      label: <TabLabel icon={<CodeOutlined />} label="Shell history" />,
      children: (
        <List
          size="small"
          bordered
          dataSource={d.shellHistory}
          style={{ background: token.colorFillQuaternary }}
          renderItem={(h) => (
            <List.Item actions={h.flag ? [<Tag key="flag" color={FLAG_COLOR[h.flag]}>{h.flag}</Tag>] : undefined}>
              <Flex gap={12} align="center" style={{ minWidth: 0, flex: 1 }}>
                <Mono style={{ color: token.colorTextTertiary, width: 56, flex: 'none' }}>{h.t}</Mono>
                <Mono style={{ color: token.colorSuccess }}>$</Mono>
                <Typography.Text ellipsis style={{ fontFamily: token.fontFamilyCode, fontSize: 12.5, color: h.flag === 'malicious' ? token.colorError : undefined }}>{h.cmd}</Typography.Text>
              </Flex>
            </List.Item>
          )}
        />
      ),
    },
  ];

  return (
    <Flex vertical gap={16} style={{ padding: 24 }}>
      <ED.PageHeader title="Endpoint detection & response" description="Inspect live process, network and history telemetry from an endpoint." />

      <Card>
        <Flex align="center" gap={16} wrap>
          <Avatar shape="square" size={48} icon={<DesktopOutlined />} style={{ background: token.colorPrimaryBg, color: token.colorPrimary }} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <Space size={12} align="center">
              <Typography.Title level={4} style={{ margin: 0, fontFamily: token.fontFamilyCode }}>win-ep-04</Typography.Title>
              <ED.StatusDot status="isolated" label="Isolated by you" />
            </Space>
            <Flex gap={16} wrap style={{ marginTop: 4 }}>
              <Typography.Text type="secondary">Windows 11 Pro · 22H2</Typography.Text>
              <Typography.Text type="secondary"><Mono>10.0.0.5</Mono></Typography.Text>
              <Typography.Text type="secondary">j.mensah (Finance)</Typography.Text>
              <Typography.Text type="danger">Risk score 92</Typography.Text>
            </Flex>
          </div>
          <Space>
            <Button icon={<CameraOutlined />}>Snapshot</Button>
            <Button danger icon={<StopOutlined />}>Contain</Button>
          </Space>
        </Flex>
      </Card>

      <Card styles={{ body: { paddingTop: 4 } }}>
        <Tabs activeKey={tab} onChange={setTab} items={items} />
      </Card>
    </Flex>
  );
}

export default EdrScreen;
