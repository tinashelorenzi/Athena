'use client';
import React from 'react';
import {
  Drawer, Tabs, Tag, Typography, Flex, Button, Collapse, Table, Empty, Descriptions, Card, Tooltip, Breadcrumb, Badge,
} from 'antd';
import { ExportOutlined, CheckCircleFilled, CheckCircleOutlined, ApartmentOutlined } from '@ant-design/icons';
import { Markdown } from '@/components/Markdown';
import { prose, techniqueFromHref } from './attackData';

const { Text, Title, Paragraph } = Typography;

/* Full technique detail, organised the way an analyst uses it:
   what it is → how to detect it → how to mitigate → who uses it. */
export function TechniqueDrawer({ data, id, studied, onToggleStudied, onOpen, onClose }) {
  const t = id ? data?.byId.get(id) : null;
  const parent = t?.isSub ? data.byId.get(t.parent) : null;
  const subs = t && !t.isSub ? data.subs.get(t.id) || [] : [];
  const tacticName = (short) => data.tactics.find((x) => x.shortname === short)?.name || short;

  // Intercept links to other ATT&CK techniques so they open in-place.
  const onProseClick = (e) => {
    const a = e.target.closest?.('a');
    const target = a && techniqueFromHref(a.getAttribute('href'));
    if (target && data.byId.has(target)) {
      e.preventDefault();
      onOpen(target);
    }
  };

  const detectionCount = t?.detections.reduce((n, d) => n + d.analytics.length, 0) ?? 0;

  return (
    <Drawer
      open={Boolean(t)}
      onClose={onClose}
      size={760}
      destroyOnHidden
      title={t && (
        <Flex vertical gap={2}>
          {parent && (
            <Breadcrumb items={[{ title: <a onClick={() => onOpen(parent.id)}>{parent.name}</a> }, { title: t.name }]} style={{ fontSize: 12 }} />
          )}
          <Flex align="center" gap={8} wrap>
            <Tag color="geekblue" style={{ fontFamily: 'var(--ath-font-family-code)', margin: 0 }}>{t.id}</Tag>
            <span>{t.name}</span>
          </Flex>
        </Flex>
      )}
      extra={t && (
        <Flex gap={8}>
          <Button
            type={studied ? 'primary' : 'default'}
            icon={studied ? <CheckCircleFilled /> : <CheckCircleOutlined />}
            onClick={() => onToggleStudied(t.id)}
          >
            {studied ? 'Studied' : 'Mark studied'}
          </Button>
          <Tooltip title="Open on attack.mitre.org">
            <Button icon={<ExportOutlined />} href={t.url} target="_blank" rel="noreferrer" aria-label="Open on attack.mitre.org" />
          </Tooltip>
        </Flex>
      )}
    >
      {t && (
        <div onClick={onProseClick}>
          <Descriptions
            size="small"
            column={1}
            bordered
            style={{ marginBottom: 16 }}
            items={[
              { key: 'tactics', label: 'Tactics', children: <Flex wrap gap={4}>{t.tactics.map((s) => <Tag key={s} color="blue">{tacticName(s)}</Tag>)}</Flex> },
              t.platforms.length > 0 && { key: 'platforms', label: 'Platforms', children: <Flex wrap gap={4}>{t.platforms.map((p) => <Tag key={p}>{p}</Tag>)}</Flex> },
              t.assets.length > 0 && {
                key: 'assets', label: 'Targeted assets',
                children: (
                  <Flex wrap gap={4}>
                    {t.assets.map((a) => (
                      <Tooltip key={a} title={data.assets[a]?.description}>
                        <Tag icon={<ApartmentOutlined />} color="purple">{data.assets[a]?.name || a}</Tag>
                      </Tooltip>
                    ))}
                  </Flex>
                ),
              },
            ].filter(Boolean)}
          />

          <Tabs
            items={[
              {
                key: 'overview',
                label: 'Overview',
                children: (
                  <>
                    <Markdown>{prose(t.description)}</Markdown>
                    {subs.length > 0 && (
                      <>
                        <Title level={5} style={{ marginTop: 16 }}>Sub-techniques</Title>
                        <Flex vertical gap={6}>
                          {subs.map((s) => (
                            <Button key={s.id} block style={{ justifyContent: 'flex-start', height: 'auto', padding: '6px 12px' }} onClick={() => onOpen(s.id)}>
                              <Text code>{s.id}</Text>
                              <span>{s.name}</span>
                            </Button>
                          ))}
                        </Flex>
                      </>
                    )}
                  </>
                ),
              },
              {
                key: 'detect',
                label: <Badge count={detectionCount} size="small" offset={[10, -2]} color="#3538D4">Detection</Badge>,
                children: <Detections t={t} />,
              },
              {
                key: 'mitigate',
                label: <Badge count={t.mitigations.length} size="small" offset={[10, -2]} color="#17915A">Mitigations</Badge>,
                children: t.mitigations.length ? (
                  <Flex vertical gap={10}>
                    {t.mitigations.map((m) => {
                      const info = data.mitigations[m.id];
                      return (
                        <Card key={m.id} size="small" title={<Flex gap={8} align="center"><Tag style={{ margin: 0 }}>{m.id}</Tag>{info?.name}</Flex>}>
                          <Markdown>{prose(m.note || info?.description)}</Markdown>
                        </Card>
                      );
                    })}
                  </Flex>
                ) : <Empty description="No mitigations documented" />,
              },
              {
                key: 'procedures',
                label: `Procedures (${t.groups.length + t.software.length})`,
                children: <Procedures t={t} data={data} />,
              },
            ]}
          />
        </div>
      )}
    </Drawer>
  );
}

function Detections({ t }) {
  if (!t.detections.length) return <Empty description="No detection strategies documented" />;
  return (
    <>
      <Paragraph type="secondary">
        MITRE detection strategies for this technique. Each analytic names the telemetry to collect and the behaviour to alert on —
        use these as a starting point for hunts in the lab&apos;s log search, EDR and OSQuery tools.
      </Paragraph>
      <Collapse
        defaultActiveKey={[t.detections[0].id]}
        items={t.detections.map((d) => ({
          key: d.id,
          label: <Flex gap={8} align="center"><Tag color="geekblue" style={{ margin: 0 }}>{d.id}</Tag>{d.name}</Flex>,
          extra: <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{d.analytics.length} analytics</Text>,
          children: (
            <Flex vertical gap={12}>
              {d.analytics.map((a) => (
                <Card
                  key={a.id}
                  size="small"
                  title={<Flex gap={6} align="center" wrap>{a.platforms.map((p) => <Tag key={p} color="cyan" style={{ margin: 0 }}>{p}</Tag>)}<Text type="secondary" style={{ fontSize: 12 }}>{a.id}</Text></Flex>}
                >
                  <Paragraph style={{ marginBottom: a.logSources.length ? 12 : 0 }}>{a.description}</Paragraph>
                  {a.logSources.length > 0 && (
                    <Table
                      size="small"
                      pagination={false}
                      rowKey="key"
                      dataSource={a.logSources.map((l, i) => ({ ...l, key: i }))}
                      columns={[
                        { title: 'Log source', dataIndex: 'source', width: 190, render: (v) => <Text code>{v}</Text> },
                        { title: 'Data component', dataIndex: 'component', width: 150 },
                        { title: 'What to look for', dataIndex: 'channel' },
                      ]}
                    />
                  )}
                </Card>
              ))}
            </Flex>
          ),
        }))}
      />
    </>
  );
}

function Procedures({ t, data }) {
  const groups = t.groups.map((g) => data.groups[g]).filter(Boolean);
  const software = t.software.map((s) => data.software[s]).filter(Boolean);
  if (!groups.length && !software.length) return <Empty description="No known procedure examples" />;
  const cols = (kind) => [
    { title: 'ID', dataIndex: 'id', width: 80, render: (v) => <Text code>{v}</Text> },
    {
      title: kind === 'group' ? 'Group' : 'Software',
      dataIndex: 'name',
      render: (v, r) => (
        <Flex vertical gap={2}>
          <Flex gap={6} align="center" wrap>
            <Text strong>{v}</Text>
            {r.type && <Tag color={r.type === 'malware' ? 'red' : 'default'} style={{ margin: 0 }}>{r.type}</Tag>}
            {r.aliases?.slice(0, 3).map((a) => <Tag key={a} style={{ margin: 0 }}>{a}</Tag>)}
          </Flex>
          <Paragraph type="secondary" ellipsis={{ rows: 2, expandable: true, symbol: 'more' }} style={{ margin: 0, fontSize: 12.5 }}>
            {prose(r.description).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}
          </Paragraph>
        </Flex>
      ),
    },
  ];
  return (
    <Flex vertical gap={16}>
      {groups.length > 0 && (
        <div>
          <Title level={5}>Threat groups ({groups.length})</Title>
          <Table size="small" rowKey="id" dataSource={groups} columns={cols('group')} pagination={{ pageSize: 8, hideOnSinglePage: true }} />
        </div>
      )}
      {software.length > 0 && (
        <div>
          <Title level={5}>Software ({software.length})</Title>
          <Table size="small" rowKey="id" dataSource={software} columns={cols('software')} pagination={{ pageSize: 8, hideOnSinglePage: true }} />
        </div>
      )}
    </Flex>
  );
}

export default TechniqueDrawer;
