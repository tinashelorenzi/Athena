'use client';
import React from 'react';
import { Row, Col, Card, Table, Badge, Segmented, Input, Button, Drawer, Descriptions, Timeline, Flex, Space, Typography, theme } from 'antd';
import { ReloadOutlined, UserAddOutlined, RiseOutlined, FileSearchOutlined, ThunderboltOutlined, BranchesOutlined, RadarChartOutlined, BellOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import * as AC from '@/components/ds';
import { SEVERITY } from '@/theme/antdTheme';
import { AthenaData } from '@/lib/data';

/* Alerts queue — triage, assign, escalate. Table + detail drawer. */
const STATUS_META = {
  open: { status: 'processing', label: 'Open' },
  in_progress: { status: 'warning', label: 'In progress' },
  escalated: { status: 'error', label: 'Escalated' },
  resolved: { status: 'success', label: 'Resolved' },
};

const SEV_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function Mono({ children }) {
  const { token } = theme.useToken();
  return <span style={{ fontFamily: token.fontFamilyCode, fontSize: 12.5 }}>{children}</span>;
}

function AlertDetail({ a, onClose }) {
  return (
    <Drawer
      open={!!a}
      onClose={onClose}
      size={420}
      title={a && (
        <Space orientation="vertical" size={6}>
          <Space size={8}>
            <AC.SeverityBadge level={a.sev} solid />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}><Mono>{a.id}</Mono></Typography.Text>
          </Space>
          <span>{a.rule}</span>
        </Space>
      )}
      footer={
        <Flex gap={8} wrap>
          <Button type="primary" icon={<UserAddOutlined />}>Assign to me</Button>
          <AC.Button variant="accent" type="button" leadingIcon={<RiseOutlined />}>Escalate</AC.Button>
          <Button icon={<FileSearchOutlined />}>View in Logs</Button>
        </Flex>
      }
    >
      {a && (
        <>
          <Descriptions
            column={2}
            size="small"
            layout="vertical"
            colon={false}
            items={[
              { key: 'detected', label: 'Detected', children: <Mono>{a.time}</Mono> },
              { key: 'host', label: 'Host', children: <Mono>{a.host}</Mono> },
              { key: 'src', label: 'Source IP', children: <Mono>{a.src}</Mono> },
              { key: 'dst', label: 'Destination', children: a.dst },
              { key: 'tactic', label: 'Tactic', children: a.tactic },
              { key: 'technique', label: 'Technique', children: <Mono>{a.technique}</Mono> },
              { key: 'events', label: 'Events', children: <Mono>{String(a.count)}</Mono> },
              { key: 'assignee', label: 'Assignee', children: a.assignee || 'Unassigned' },
            ]}
          />
          <Typography.Title level={5} style={{ marginTop: 8 }}>Triage timeline</Typography.Title>
          <Timeline
            items={[
              { icon: <ThunderboltOutlined />, title: 'Rule matched', content: <Typography.Text type="secondary"><Mono>{a.time}</Mono></Typography.Text> },
              { icon: <BranchesOutlined />, title: 'Correlated with 2 alerts', content: <Typography.Text type="secondary"><Mono>14:32</Mono></Typography.Text> },
              { icon: <RadarChartOutlined />, title: 'Enriched with threat intel', content: <Typography.Text type="secondary"><Mono>14:32</Mono></Typography.Text> },
            ]}
          />
        </>
      )}
    </Drawer>
  );
}

export function AlertsScreen() {
  const alerts = AthenaData.alerts;
  const [sel, setSel] = React.useState(null);
  const [sev, setSev] = React.useState('all');
  const rows = sev === 'all' ? alerts : alerts.filter((a) => a.sev === sev);
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  alerts.forEach((a) => { if (counts[a.sev] != null) counts[a.sev]++; });

  const columns = [
    { key: 'sev', dataIndex: 'sev', title: 'Severity', width: 120, render: (v) => <AC.SeverityBadge level={v} /> },
    { key: 'time', dataIndex: 'time', title: 'Detected', width: 170, render: (v) => <Mono>{v}</Mono> },
    { key: 'rule', dataIndex: 'rule', title: 'Rule', render: (v) => <Typography.Text strong>{v}</Typography.Text> },
    { key: 'host', dataIndex: 'host', title: 'Host', width: 120, render: (v) => <Mono>{v}</Mono> },
    { key: 'status', dataIndex: 'status', title: 'Status', width: 130, render: (v) => <Badge status={STATUS_META[v].status} text={STATUS_META[v].label} /> },
    { key: 'count', dataIndex: 'count', title: 'Events', width: 90, align: 'right', render: (v) => <Mono>{v}</Mono> },
  ];

  return (
    <Flex vertical gap={16} style={{ padding: 24 }}>
      <AC.PageHeader title="Alerts" description="Triage, assign and escalate detections from across the lab." />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <AC.StatCard label="Open alerts" value={String(alerts.filter((a) => a.status === 'open').length)} icon={<BellOutlined />} delta="+3" deltaDir="up" hint="last hour" />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <AC.StatCard label="Critical" value={String(counts.critical)} tone="critical" delta="+1" deltaDir="up" />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <AC.StatCard label="Assigned to me" value="2" icon={<UserOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <AC.StatCard label="Median triage" value="4m 12s" icon={<ClockCircleOutlined />} deltaDir="down" delta="-38s" hint="better" />
        </Col>
      </Row>

      <Card
        title={<Segmented value={sev} onChange={setSev} options={SEV_FILTERS.map((f) => ({ ...f, label: f.value === 'all' ? f.label : <Space size={6}><Badge color={SEVERITY[f.value].hex} />{f.label}</Space> }))} />}
        extra={
          <Space>
            <Input.Search placeholder="Filter alerts…" allowClear style={{ width: 220 }} />
            <Button icon={<ReloadOutlined />}>Refresh</Button>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 'max-content' }}
          rowClassName={(r) => (sel && sel.id === r.id ? 'ant-table-row-selected' : '')}
          onRow={(r) => ({ onClick: () => setSel(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      <AlertDetail a={sel} onClose={() => setSel(null)} />
    </Flex>
  );
}

export default AlertsScreen;
