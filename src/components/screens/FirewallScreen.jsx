'use client';
import React from 'react';
import { Row, Col, Card, Table, Tag, Switch, List, Alert, Button, Flex, Typography, theme } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import * as FW from '@/components/ds';
import { AthenaData } from '@/lib/data';

/* Firewall & UTM — policy rules table + security profiles. */
export function FirewallScreen() {
  const { token } = theme.useToken();
  const [rules, setRules] = React.useState(AthenaData.firewallRules);
  const utm = AthenaData.utm;
  const toggle = (id) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  const mono = { fontFamily: token.fontFamilyCode, fontSize: 12.5 };

  const columns = [
    { key: 'on', title: 'On', width: 64, render: (_, r) => <Switch size="small" checked={r.enabled} onChange={() => toggle(r.id)} aria-label={`Toggle rule ${r.id}`} /> },
    { key: 'idx', title: '#', width: 56, render: (_, __, i) => <Typography.Text type="secondary" style={mono}>{String(i + 1).padStart(2, '0')}</Typography.Text> },
    { key: 'action', dataIndex: 'action', title: 'Action', width: 96, render: (v) => <Tag color={v === 'deny' ? 'error' : 'success'} style={{ marginInlineEnd: 0 }}>{v === 'deny' ? 'DENY' : 'ALLOW'}</Tag> },
    { key: 'src', dataIndex: 'src', title: 'Source', render: (v) => <span style={mono}>{v}</span> },
    { key: 'dst', dataIndex: 'dst', title: 'Destination', render: (v) => <span style={mono}>{v}</span> },
    { key: 'port', dataIndex: 'port', title: 'Port', width: 80, render: (v) => <span style={mono}>{v}</span> },
    { key: 'proto', dataIndex: 'proto', title: 'Proto', width: 80, render: (v) => <span style={mono}>{v}</span> },
    { key: 'note', dataIndex: 'note', title: 'Note', ellipsis: true, render: (v) => <Typography.Text type="secondary">{v}</Typography.Text> },
    { key: 'hits', dataIndex: 'hits', title: 'Hits', width: 90, align: 'right', render: (v) => <span style={{ ...mono, color: v > 500 ? token.colorWarningText : undefined, fontWeight: v > 500 ? 600 : 400 }}>{v.toLocaleString()}</span> },
  ];

  return (
    <Flex vertical gap={16} style={{ padding: 24 }}>
      <FW.PageHeader
        title="Firewall & UTM"
        description="Policy — Perimeter (edge-fw-01). Rules evaluate top-down; first match wins."
        extra={<Button type="primary" icon={<PlusOutlined />}>Add rule</Button>}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={17}>
          <Card title="Policy rules" styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="id"
              size="medium"
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={columns}
              dataSource={rules}
              onRow={(r) => ({ style: { opacity: r.enabled ? 1 : 0.5 } })}
            />
          </Card>
        </Col>
        <Col xs={24} xl={7}>
          <Flex vertical gap={16}>
            <Card title="UTM profiles" extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>Unified threat management</Typography.Text>} styles={{ body: { padding: '0 16px' } }}>
              <List
                dataSource={utm}
                renderItem={(u) => (
                  <List.Item actions={[<Switch key="on" size="small" checked={u.on} onChange={() => {}} aria-label={`Toggle ${u.name}`} />]}>
                    <List.Item.Meta title={u.name} description={<span style={{ fontSize: 12 }}>{u.detail}</span>} />
                  </List.Item>
                )}
              />
            </Card>
            <Alert type="info" showIcon title="Objective" description="Block the C2 IP 185.220.101.34 to complete containment." />
          </Flex>
        </Col>
      </Row>
    </Flex>
  );
}

export default FirewallScreen;
