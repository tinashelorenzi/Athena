'use client';
import React from 'react';
import { Row, Col, Card, Input, List, Avatar, Tag, Badge, Progress, Descriptions, Alert, Button, Flex, Space, Typography, theme } from 'antd';
import { GlobalOutlined, LinkOutlined, FileProtectOutlined, SafetyCertificateOutlined, StopOutlined, BookOutlined, RadarChartOutlined } from '@ant-design/icons';
import * as TI from '@/components/ds';
import { AthenaData } from '@/lib/data';

/* Threat Intelligence — IOC search + enrichment. */
const VERDICT = {
  malicious: { tag: 'error', status: 'error', color: 'var(--sev-critical)', label: 'Malicious' },
  suspicious: { tag: 'warning', status: 'warning', color: 'var(--sev-high)', label: 'Suspicious' },
  informational: { tag: 'default', status: 'default', color: 'var(--text-tertiary)', label: 'Informational' },
};
const TYPE_ICON = { IPv4: <GlobalOutlined />, Domain: <LinkOutlined />, 'SHA-256': <FileProtectOutlined />, CVE: <SafetyCertificateOutlined /> };

export function IntelScreen() {
  const { token } = theme.useToken();
  const iocs = AthenaData.iocs;
  const [sel, setSel] = React.useState(iocs[0]);
  const [q, setQ] = React.useState('185.220.101.34');
  const mono = { fontFamily: token.fontFamilyCode };

  return (
    <Flex vertical gap={16} style={{ padding: 24 }}>
      <TI.PageHeader title="Threat intelligence" description={`Look up indicators and review enrichment · aggregated across ${sel ? sel.sources : 0} feeds, results cached 5m`} />

      <Input.Search
        value={q}
        onChange={(e) => setQ(e.target.value)}
        size="large"
        prefix={<RadarChartOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder="Search an IP, domain, hash, or CVE…"
        enterButton="Look up"
        style={mono}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14} xxl={16}>
          <Card title="Indicators" styles={{ body: { padding: 0 } }}>
            <List
              dataSource={iocs}
              renderItem={(io) => {
                const v = VERDICT[io.verdict];
                const active = sel && sel.value === io.value;
                return (
                  <List.Item
                    onClick={() => setSel(io)}
                    style={{ cursor: 'pointer', paddingInline: 16, background: active ? token.controlItemBgActive : undefined }}
                    actions={[
                      <Typography.Text key="type" type="secondary" style={{ ...mono, fontSize: 11 }}>{io.type}</Typography.Text>,
                      <Tag key="verdict" color={v.tag} style={{ marginInlineEnd: 0 }}>{v.label}</Tag>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar shape="square" icon={TYPE_ICON[io.type]} style={{ background: token.colorFillTertiary, color: v.color }} />}
                      title={<Typography.Text ellipsis style={{ ...mono, fontSize: 14 }}>{io.value}</Typography.Text>}
                      description={<Space size={4} wrap>{io.tags.map((t) => <Tag key={t} variant="filled" style={{ marginInlineEnd: 0, fontSize: 11 }}>{t}</Tag>)}</Space>}
                    />
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10} xxl={8}>
          {sel && (
            <Card
              title={
                <Space orientation="vertical" size={2} style={{ padding: '12px 0' }}>
                  <Space size={8}>
                    <span style={{ color: VERDICT[sel.verdict].color }}>{TYPE_ICON[sel.type]}</span>
                    <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>{sel.type}</Typography.Text>
                  </Space>
                  <Typography.Text style={{ ...mono, fontSize: 16, wordBreak: 'break-all', whiteSpace: 'normal' }}>{sel.value}</Typography.Text>
                </Space>
              }
            >
              <Flex vertical gap={16}>
                <div>
                  <Flex justify="space-between" align="baseline">
                    <Typography.Text type="secondary">Threat score</Typography.Text>
                    <span style={{ ...mono, fontSize: 22, fontWeight: 600, color: VERDICT[sel.verdict].color }}>
                      {sel.score}<Typography.Text type="secondary" style={{ fontSize: 13 }}>/100</Typography.Text>
                    </span>
                  </Flex>
                  <Progress percent={sel.score} showInfo={false} strokeColor={VERDICT[sel.verdict].color} style={{ margin: 0 }} />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>Flagged by <Typography.Text strong>{sel.sources}</Typography.Text> of 60 sources</Typography.Text>
                </div>

                <Descriptions
                  column={2}
                  size="small"
                  layout="vertical"
                  colon={false}
                  items={[
                    { key: 'first', label: 'First seen', children: sel.first },
                    { key: 'asn', label: 'Network', children: sel.asn },
                    { key: 'verdict', label: 'Verdict', children: <Badge status={VERDICT[sel.verdict].status} text={VERDICT[sel.verdict].label} /> },
                    { key: 'sources', label: 'Sources', children: String(sel.sources) },
                  ]}
                />

                <Alert type="warning" showIcon icon={<LinkOutlined />} title="Related to your scenario" description="Seen in 3 alerts on win-ep-04" />

                <Space wrap>
                  <Button type="primary" danger icon={<StopOutlined />}>Block in firewall</Button>
                  <Button icon={<BookOutlined />}>Add to case</Button>
                </Space>
              </Flex>
            </Card>
          )}
        </Col>
      </Row>
    </Flex>
  );
}

export default IntelScreen;
