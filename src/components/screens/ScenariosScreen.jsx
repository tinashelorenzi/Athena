'use client';
import React from 'react';
import { Row, Col, Card, Tag, Button, Progress, Segmented, Flex, Space, Typography, theme } from 'antd';
import { ArrowRightOutlined, CaretRightOutlined, FilterOutlined, SignalFilled, ClockCircleOutlined, UnorderedListOutlined } from '@ant-design/icons';
import * as SC from '@/components/ds';
import { AthenaData } from '@/lib/data';

/* Scenarios catalog — browse, read briefing, start a scenario. */
const DIFF_COLOR = { Beginner: 'var(--sev-low)', Intermediate: 'var(--sev-medium)', Advanced: 'var(--sev-critical)' };

function ScenarioCard({ s, onStart }) {
  const { token } = theme.useToken();
  const done = s.status === 'completed';
  const active = s.status === 'active';

  const footer = (active || done) ? (
    <Flex align="center" gap={12} style={{ padding: '0 16px' }}>
      <Progress
        percent={s.total ? Math.round((s.progress / s.total) * 100) : 0}
        showInfo={false}
        strokeColor={done ? token.colorSuccess : '#F9C80E'}
        style={{ flex: 1, margin: 0 }}
      />
      <Typography.Text type="secondary" style={{ fontFamily: token.fontFamilyCode, fontSize: 12 }}>{s.progress}/{s.total}</Typography.Text>
      <Button type={active ? 'primary' : 'default'} onClick={onStart} icon={<ArrowRightOutlined />} iconPlacement="end">
        {active ? 'Resume' : 'Review'}
      </Button>
    </Flex>
  ) : (
    <Flex align="center" gap={12} style={{ padding: '0 16px' }}>
      <Typography.Text type="secondary" style={{ flex: 1, textAlign: 'left' }}>Not started</Typography.Text>
      <Button type="primary" onClick={onStart} icon={<CaretRightOutlined />}>Start scenario</Button>
    </Flex>
  );

  return (
    <Card
      hoverable
      style={{ height: '100%', display: 'flex', flexDirection: 'column', borderColor: active ? token.colorWarningBorder : undefined }}
      styles={{ body: { flex: 1 } }}
      actions={[footer]}
    >
      <Flex align="center" gap={8} style={{ marginBottom: 12 }}>
        <Typography.Text type="secondary" style={{ fontFamily: token.fontFamilyCode, fontSize: 11 }}>{s.id}</Typography.Text>
        <Tag style={{ marginInlineEnd: 0 }}>{s.tag}</Tag>
        <div style={{ flex: 1 }} />
        {active && <Tag color="gold" style={{ marginInlineEnd: 0 }}>In progress</Tag>}
        {done && <Tag color="success" style={{ marginInlineEnd: 0 }}>Completed</Tag>}
      </Flex>

      <Typography.Title level={5} style={{ marginTop: 0 }}>{s.title}</Typography.Title>
      <Typography.Paragraph type="secondary">{s.desc}</Typography.Paragraph>
      <Space size={[6, 6]} wrap style={{ marginBottom: 14 }}>
        {s.tactics.map((t) => <Tag key={t} variant="filled" style={{ marginInlineEnd: 0 }}>{t}</Tag>)}
      </Space>

      <Space size={16} wrap>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}><SignalFilled style={{ color: DIFF_COLOR[s.difficulty] }} /> {s.difficulty}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}><ClockCircleOutlined /> {s.mins} min</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}><UnorderedListOutlined /> {s.total} objectives</Typography.Text>
      </Space>
    </Card>
  );
}

export function ScenariosScreen({ onStart }) {
  const [tab, setTab] = React.useState('all');
  const all = AthenaData.scenarios;
  const filtered = tab === 'all' ? all : all.filter((s) => (tab === 'active' ? s.status !== 'available' : s.status === 'available'));

  return (
    <Flex vertical gap={16} style={{ padding: 24, maxWidth: 1280, margin: '0 auto', width: '100%' }}>
      <SC.PageHeader
        title="Scenarios"
        description="Pick an exercise. Starting a scenario activates its alerts, logs, and endpoints across Athena."
        extra={<Button icon={<FilterOutlined />}>Filters</Button>}
      />

      <Segmented
        value={tab}
        onChange={setTab}
        style={{ alignSelf: 'flex-start' }}
        options={[
          { value: 'all', label: <Space size={6}>All scenarios<Tag style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '16px' }}>{all.length}</Tag></Space> },
          { value: 'active', label: 'My progress' },
          { value: 'available', label: 'Available' },
        ]}
      />

      <Row gutter={[16, 16]}>
        {filtered.map((s) => (
          <Col key={s.id} xs={24} md={12} xxl={8}>
            <ScenarioCard s={s} onStart={onStart} />
          </Col>
        ))}
      </Row>
    </Flex>
  );
}

export default ScenariosScreen;
