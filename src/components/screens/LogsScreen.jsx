'use client';
import React from 'react';
import { Row, Col, Card, Collapse, Progress, Input, Table, Button, Tooltip, Flex, Space, Statistic, Typography, theme } from 'antd';
import { PlusOutlined, WifiOutlined, InsertRowRightOutlined, DownloadOutlined, NumberOutlined } from '@ant-design/icons';
import * as LG from '@/components/ds';
import { AthenaData } from '@/lib/data';

/* Logs — Kibana-Discover-style explorer: KQL bar, field sidebar, histogram, docs. */
const LEVEL_COLOR = { critical: 'var(--sev-critical)', warning: 'var(--sev-high)', notice: 'var(--accent)', info: 'var(--text-tertiary)' };

const S = {
  field: { color: 'var(--syntax-field)' },
  op: { color: 'var(--syntax-operator)' },
  str: { color: 'var(--syntax-string)' },
  num: { color: 'var(--syntax-number)' },
  val: { color: 'var(--syntax-value)' },
};

function FieldSidebar() {
  const { token } = theme.useToken();
  const [open, setOpen] = React.useState('event.action');
  const [filter, setFilter] = React.useState('');
  const fields = AthenaData.fields.filter((f) => f.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <Card title="Available fields" size="small" styles={{ body: { padding: 8 } }}>
      <Input.Search placeholder="Search fields" size="small" allowClear value={filter} onChange={(e) => setFilter(e.target.value)} style={{ marginBottom: 8 }} />
      <Collapse
        accordion
        ghost
        size="small"
        activeKey={open ? [open] : []}
        onChange={(k) => setOpen((Array.isArray(k) ? k[0] : k) || null)}
        items={fields.map((f) => ({
          key: f.name,
          label: (
            <Space size={6} style={{ minWidth: 0 }}>
              <NumberOutlined style={{ color: 'var(--syntax-field)' }} />
              <Typography.Text ellipsis style={{ fontFamily: token.fontFamilyCode, fontSize: 12, maxWidth: 170 }}>{f.name}</Typography.Text>
            </Space>
          ),
          children: (
            <Flex vertical gap={6}>
              {f.top.map(([val, n]) => {
                const pct = Math.round((n / f.count) * 100);
                return (
                  <div key={val}>
                    <Flex justify="space-between" style={{ fontSize: 11 }}>
                      <Typography.Text ellipsis style={{ fontFamily: token.fontFamilyCode, fontSize: 11, maxWidth: 150 }}>{val}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>{pct}%</Typography.Text>
                    </Flex>
                    <Progress percent={pct} showInfo={false} size={{ height: 4 }} style={{ margin: 0 }} />
                  </div>
                );
              })}
            </Flex>
          ),
        }))}
      />
    </Card>
  );
}

function Histogram() {
  const { token } = theme.useToken();
  const bars = AthenaData.histogram;
  const max = Math.max(...bars);
  return (
    <div>
      <Flex align="flex-end" gap={3} style={{ height: 74 }}>
        {bars.map((b, i) => (
          <Tooltip key={i} title={`${b} events`}>
            <div style={{ flex: 1, height: Math.max(3, (b / max) * 100) + '%', background: i > 13 ? token.colorError : token.colorPrimary, opacity: i > 13 ? 0.9 : 0.6, borderRadius: '2px 2px 0 0' }} />
          </Tooltip>
        ))}
      </Flex>
      <Flex justify="space-between" style={{ fontFamily: token.fontFamilyCode, fontSize: 10, color: token.colorTextTertiary, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        <span>14:15</span><span>14:20</span><span>14:25</span><span>14:30</span><span>now</span>
      </Flex>
    </div>
  );
}

function DocSummary({ d }) {
  const { token } = theme.useToken();
  return (
    <div style={{ fontFamily: token.fontFamilyCode, fontSize: 12, lineHeight: 1.5, color: token.colorTextSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
      <span style={{ color: LEVEL_COLOR[d.level], fontWeight: 600 }}>{d.level}</span>
      <span style={{ color: token.colorTextTertiary }}> · </span>
      <span style={S.field}>host</span><span style={S.op}>:</span><span style={{ color: token.colorText }}>{d.host}</span>
      <span style={{ color: token.colorTextTertiary }}> · </span>
      <span style={S.field}>event.action</span><span style={S.op}>:</span><span style={S.val}>{d.action}</span>
      <span style={{ color: token.colorTextTertiary }}> · </span>{d.msg}
    </div>
  );
}

function DocJson({ d }) {
  const { token } = theme.useToken();
  const line = (k, v, style, last) => (
    <div key={k}>
      {'  '}<span style={S.field}>&quot;{k}&quot;</span>: <span style={style}>{style === S.num ? v : `"${v}"`}</span>{last ? '' : ','}
    </div>
  );
  return (
    <pre style={{ margin: 0, fontFamily: token.fontFamilyCode, fontSize: 12, lineHeight: 1.7, color: token.colorTextSecondary, whiteSpace: 'pre-wrap' }}>
      {'{'}
      {line('@timestamp', d.t, S.str)}
      {line('event.level', d.level, S.str)}
      {line('host.name', d.host, S.str)}
      {line('event.action', d.action, S.str)}
      {line('user.name', d.user, S.str)}
      {line('process.pid', d.pid, S.num)}
      {line('process.parent.pid', d.ppid, S.num)}
      {line('message', d.msg, S.str, true)}
      {'}'}
    </pre>
  );
}

export function LogsScreen() {
  const { token } = theme.useToken();
  const [q, setQ] = React.useState('event.action : "process_start" and user.name : "svc-batch"');
  const [lang, setLang] = React.useState('KQL');
  const [exp, setExp] = React.useState(0);
  const logs = AthenaData.logs;
  const rows = logs.map((d, i) => ({ ...d, __i: i }));

  return (
    <Flex vertical gap={16} style={{ padding: 24 }}>
      <LG.PageHeader title="Logs" description="Search and explore raw events across every log source." />

      <Card size="small">
        <Flex vertical gap={10}>
          <LG.KqlBar value={q} onChange={setQ} onRun={() => {}} language={lang} onToggleLanguage={() => setLang((l) => (l === 'KQL' ? 'EQL' : 'KQL'))} timeRange="Last 15 minutes" />
          <Flex align="center" gap={8} wrap>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Filters</Typography.Text>
            <LG.Tag filter field="host.name" op=":" value="win-ep-04" onRemove={() => {}} />
            <LG.Tag filter field="event.outcome" op=":" value="success" onRemove={() => {}} />
            <Button type="link" size="small" icon={<PlusOutlined />}>Add filter</Button>
          </Flex>
        </Flex>
      </Card>

      <Row gutter={[16, 16]} wrap={false}>
        <Col flex="260px"><FieldSidebar /></Col>
        <Col flex="auto" style={{ minWidth: 0 }}>
          <Card
            size="small"
            title={
              <Space align="baseline" size={8}>
                <Statistic value={1284} styles={{ content: { fontSize: 18, fontFamily: token.fontFamilyCode, fontWeight: 600 } }} />
                <Typography.Text type="secondary" style={{ fontSize: 12.5, fontWeight: 400 }}>events · 10 shown</Typography.Text>
              </Space>
            }
            extra={
              <Space size={6}>
                <Tooltip title="Live tail"><Button aria-label="Live tail" icon={<WifiOutlined />} /></Tooltip>
                <Tooltip title="Columns"><Button aria-label="Columns" icon={<InsertRowRightOutlined />} /></Tooltip>
                <Tooltip title="Export"><Button aria-label="Export" icon={<DownloadOutlined />} /></Tooltip>
              </Space>
            }
            styles={{ body: { padding: 0 } }}
          >
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}><Histogram /></div>
            <Table
              size="small"
              rowKey="__i"
              pagination={false}
              dataSource={rows}
              tableLayout="fixed"
              columns={[
                { key: 't', dataIndex: 't', title: 'Time', width: 190, render: (v) => <span style={{ fontFamily: token.fontFamilyCode, fontSize: 12 }}>{v}</span> },
                { key: 'doc', title: 'Document', render: (_, d) => <DocSummary d={d} /> },
              ]}
              expandable={{
                expandedRowKeys: exp >= 0 ? [exp] : [],
                onExpand: (expanded, r) => setExp(expanded ? r.__i : -1),
                expandRowByClick: true,
                expandedRowRender: (d) => <DocJson d={d} />,
              }}
            />
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}

export default LogsScreen;
