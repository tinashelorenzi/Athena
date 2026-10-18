'use client';
import React from 'react';
import { Row, Col, Card, List, Avatar, Tag, Badge, Button, Descriptions, Statistic, Flex, Space, Typography, theme } from 'antd';
import { DownloadOutlined, FileSearchOutlined, FileTextOutlined, SettingOutlined, FileZipOutlined, HddOutlined } from '@ant-design/icons';
import * as FO from '@/components/ds';

/* Forensics — scenario sample artifacts + static analysis. */
const SAMPLES = [
  { id: 1, name: 'Invoice_July.docm', type: 'Office macro', size: '84 KB', sha: 'a3f5c9d1…e8b027', verdict: 'malicious', icon: <FileTextOutlined /> },
  { id: 2, name: 'svc.exe', type: 'PE32 executable', size: '412 KB', sha: '7bd44e2a…91ff03', verdict: 'malicious', icon: <SettingOutlined /> },
  { id: 3, name: 'capture_1432.pcap', type: 'Network capture', size: '2.1 MB', sha: 'c01aa8f4…5d7e12', verdict: 'suspicious', icon: <FileZipOutlined /> },
  { id: 4, name: 'memory.dmp', type: 'Memory image', size: '1.9 GB', sha: 'ff2093bc…0a4471', verdict: 'pending', icon: <HddOutlined /> },
];
const VT = {
  malicious: { tag: 'error', status: 'error', color: 'var(--sev-critical)', label: 'Malicious' },
  suspicious: { tag: 'warning', status: 'warning', color: 'var(--sev-high)', label: 'Suspicious' },
  pending: { tag: 'default', status: 'default', color: 'var(--text-tertiary)', label: 'Not analyzed' },
};
const STRINGS = ['powershell -nop -w hidden -enc', 'pay-invoice-verify.top', '185.220.101.34', 'vssadmin delete shadows', 'CreateRemoteThread', '.locked', 'YOUR FILES HAVE BEEN ENCRYPTED'];

export function ForensicsScreen() {
  const { token } = theme.useToken();
  const [sel, setSel] = React.useState(SAMPLES[0]);
  const mono = { fontFamily: token.fontFamilyCode };
  const v = VT[sel.verdict];

  return (
    <Flex vertical gap={16} style={{ padding: 24 }}>
      <FO.PageHeader title="Forensics" description="Static analysis of the artifacts collected for this scenario." />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9} xxl={7}>
          <Card title="Samples" extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>Ransomware in Finance</Typography.Text>} styles={{ body: { padding: 0 } }}>
            <List
              dataSource={SAMPLES}
              renderItem={(s) => {
                const sv = VT[s.verdict];
                const active = sel.id === s.id;
                return (
                  <List.Item
                    onClick={() => setSel(s)}
                    style={{ cursor: 'pointer', paddingInline: 16, background: active ? token.controlItemBgActive : undefined }}
                    actions={[<Badge key="v" status={sv.status} />]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar shape="square" icon={s.icon} style={{ background: token.colorFillTertiary, color: sv.color }} />}
                      title={<Typography.Text ellipsis style={{ ...mono, fontSize: 13 }}>{s.name}</Typography.Text>}
                      description={<span style={{ fontSize: 12 }}>{s.type} · {s.size}</span>}
                    />
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={15} xxl={17}>
          <Flex vertical gap={16}>
            <Card>
              <Flex align="center" gap={14} wrap>
                <Avatar shape="square" size={48} icon={sel.icon} style={{ background: token.colorFillTertiary, color: v.color }} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Space size={10} align="center" wrap>
                    <Typography.Title level={4} style={{ ...mono, margin: 0 }}>{sel.name}</Typography.Title>
                    <Tag color={v.tag} style={{ marginInlineEnd: 0 }}>{v.label}</Tag>
                  </Space>
                  <div><Typography.Text type="secondary">{sel.type} · {sel.size}</Typography.Text></div>
                </div>
                <Space>
                  <Button icon={<DownloadOutlined />}>Download</Button>
                  <Button type="primary" icon={<FileSearchOutlined />}>Re-analyze</Button>
                </Space>
              </Flex>
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card title="Hashes" size="small" style={{ height: '100%' }}>
                  <Descriptions
                    column={1}
                    size="small"
                    colon={false}
                    styles={{ label: { ...mono, fontSize: 12 }, content: { ...mono, fontSize: 12, justifyContent: 'flex-end' } }}
                    items={[
                      { key: 'sha', label: 'SHA-256', children: sel.sha },
                      { key: 'md5', label: 'MD5', children: '9e107d9d…f98402' },
                      { key: 'ssdeep', label: 'SSDEEP', children: '3072:xF9k…' },
                    ]}
                  />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Detection" size="small" style={{ height: '100%' }}>
                  <Statistic
                    value={41}
                    suffix={<Typography.Text type="secondary" style={{ fontSize: 13 }}>/ 68 engines flagged</Typography.Text>}
                    styles={{ content: { ...mono, fontWeight: 600, color: v.color } }}
                  />
                  <Space size={6} wrap style={{ marginTop: 10 }}>
                    {['Ransom.LockBit', 'Trojan.Downloader', 'W97M/Dropper'].map((t) => <Tag key={t} color="error" style={{ ...mono, marginInlineEnd: 0 }}>{t}</Tag>)}
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card title="Interesting strings" size="small">
              <div style={{ ...mono, fontSize: 12.5, lineHeight: 1.9, background: token.colorFillQuaternary, borderRadius: token.borderRadius, padding: '10px 14px' }}>
                {STRINGS.map((s, i) => (
                  <div key={i} style={{ color: /top|101\.34|encrypt|ENCRYPTED|enc|shadows/i.test(s) ? 'var(--sev-high)' : token.colorTextSecondary }}>
                    <span style={{ color: token.colorTextTertiary, marginRight: 12 }}>{String(0x400 + i * 16).toString(16).padStart(6, '0')}</span>{s}
                  </div>
                ))}
              </div>
            </Card>
          </Flex>
        </Col>
      </Row>
    </Flex>
  );
}

export default ForensicsScreen;
