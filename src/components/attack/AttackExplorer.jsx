'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, Segmented, Input, Select, Switch, Flex, Typography, Tag, Table, Skeleton, Result, Statistic, Row, Col,
  Progress, Tooltip, Button, Alert,
} from 'antd';
import {
  AppstoreOutlined, UnorderedListOutlined, CloudServerOutlined, ControlOutlined, CheckCircleFilled,
  SafetyCertificateOutlined, EyeOutlined, TeamOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { DOMAINS, useAttackDataset, useMatrix, useStudied } from './attackData';
import { AttackMatrix } from './AttackMatrix';
import { TechniqueDrawer } from './TechniqueDrawer';

const { Title, Text, Paragraph } = Typography;

/* MITRE ATT&CK Explorer — Enterprise + ICS matrices with search, platform /
   asset filters, sub-technique expansion, technique detail (detection
   analytics, mitigations, procedures) and personal "studied" progress. */
export function AttackExplorer({ initialDomain = 'enterprise', initialTechnique = null }) {
  const [domain, setDomain] = useState(DOMAINS[initialDomain] ? initialDomain : 'enterprise');
  const [view, setView] = useState('matrix');
  const [query, setQuery] = useState('');
  const [platforms, setPlatforms] = useState([]);
  const [assets, setAssets] = useState([]);
  const [studiedOnly, setStudiedOnly] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [openId, setOpenId] = useState(initialTechnique);
  const { data, error } = useAttackDataset(domain);
  const [studied, toggleStudied] = useStudied();
  const { columns, matches, total } = useMatrix(data, { query, platforms, assets, studiedOnly, studied });

  // Keep ?domain=&t= in the URL so a technique can be shared or bookmarked.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('domain', domain);
    if (openId) url.searchParams.set('t', openId); else url.searchParams.delete('t');
    window.history.replaceState(null, '', url);
  }, [domain, openId]);

  const switchDomain = (d) => {
    setDomain(d);
    setPlatforms([]);
    setAssets([]);
    setOpenId(null);
  };
  const open = useCallback((id) => setOpenId(id), []);

  const domainStudied = useMemo(
    () => (data ? data.techniques.filter((t) => studied.has(t.id)).length : 0),
    [data, studied],
  );
  const filtering = Boolean(query.trim() || platforms.length || assets.length || studiedOnly);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Flex justify="space-between" align="flex-end" wrap gap={16}>
        <div>
          <Title level={3} style={{ margin: 0 }}>MITRE ATT&amp;CK Explorer</Title>
          <Paragraph type="secondary" style={{ margin: '4px 0 0', maxWidth: 720 }}>
            Browse adversary tactics and techniques, then learn how to detect and mitigate each one.
            Switch to <Text strong>ICS</Text> for attacks on industrial control systems.
          </Paragraph>
        </div>
        <Segmented
          size="large"
          value={domain}
          onChange={switchDomain}
          options={[
            { value: 'enterprise', label: 'Enterprise', icon: <CloudServerOutlined /> },
            { value: 'ics', label: 'ICS', icon: <ControlOutlined /> },
          ]}
        />
      </Flex>

      {error && (
        <Result
          status="warning"
          title="ATT&CK data unavailable"
          subTitle={`${error.message}. An administrator can generate it with "npm run sync:attack".`}
          extra={<Button icon={<ReloadOutlined />} onClick={() => switchDomain(domain)}>Retry</Button>}
        />
      )}

      {!error && !data && <Card><Skeleton active paragraph={{ rows: 10 }} /></Card>}

      {data && (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}><Card size="small" style={{ height: '100%' }}><Statistic title="Tactics" value={data.tactics.length} prefix={<AppstoreOutlined />} /></Card></Col>
            <Col xs={12} md={6}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic title="Techniques" value={data.techniques.filter((t) => !t.isSub).length} suffix={<Text type="secondary" style={{ fontSize: 13 }}>+ {data.techniques.filter((t) => t.isSub).length} sub</Text>} prefix={<EyeOutlined />} />
              </Card>
            </Col>
            <Col xs={12} md={6}><Card size="small" style={{ height: '100%' }}><Statistic title="Threat groups" value={Object.keys(data.groups).length} prefix={<TeamOutlined />} /></Card></Col>
            <Col xs={12} md={6}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic title="You've studied" value={domainStudied} suffix={`/ ${total}`} prefix={<CheckCircleFilled style={{ color: '#17915A' }} />} />
                <Progress percent={Math.round((domainStudied / Math.max(total, 1)) * 100)} size="small" showInfo={false} strokeColor="#17915A" style={{ margin: 0 }} />
              </Card>
            </Col>
          </Row>

          <Card styles={{ body: { padding: 16 } }}>
            <Flex gap={12} wrap align="center" style={{ marginBottom: 16 }}>
              <Input.Search
                allowClear
                placeholder="Search by technique name or ID (e.g. PowerShell, T1566)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: 360, maxWidth: '100%' }}
              />
              <Select
                mode="multiple"
                allowClear
                maxTagCount="responsive"
                placeholder="All platforms"
                value={platforms}
                onChange={setPlatforms}
                options={data.platforms.map((p) => ({ value: p, label: p }))}
                style={{ minWidth: 200, maxWidth: 320 }}
              />
              {domain === 'ics' && (
                <Select
                  mode="multiple"
                  allowClear
                  maxTagCount="responsive"
                  placeholder="All assets"
                  value={assets}
                  onChange={setAssets}
                  options={Object.values(data.assets).map((a) => ({ value: a.id, label: a.name }))}
                  style={{ minWidth: 200, maxWidth: 320 }}
                />
              )}
              <Flex align="center" gap={6}>
                <Switch size="small" checked={studiedOnly} onChange={setStudiedOnly} id="studied-only" />
                <label htmlFor="studied-only"><Text>Studied only</Text></label>
              </Flex>
              {view === 'matrix' && (
                <Flex align="center" gap={6}>
                  <Switch size="small" checked={expandAll} onChange={setExpandAll} id="expand-all" />
                  <label htmlFor="expand-all"><Text>Show sub-techniques</Text></label>
                </Flex>
              )}
              <div style={{ flex: 1 }} />
              {filtering && <Tag color="processing">{matches.size} matching</Tag>}
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { value: 'matrix', icon: <AppstoreOutlined />, label: 'Matrix' },
                  { value: 'list', icon: <UnorderedListOutlined />, label: 'List' },
                ]}
              />
            </Flex>

            {domain === 'ics' && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                title="ATT&CK for ICS covers adversary behaviour against industrial control systems — PLCs, HMIs, engineering workstations, historians and safety systems. Filter by asset to focus on a specific layer of the plant."
              />
            )}

            {view === 'matrix' ? (
              <AttackMatrix columns={columns} matches={matches} query={query} studied={studied} expandAll={expandAll} onOpen={open} />
            ) : (
              <TechniqueTable data={data} matches={matches} studied={studied} onOpen={open} />
            )}
          </Card>

          <Text type="secondary" style={{ fontSize: 12 }}>
            <SafetyCertificateOutlined /> {data.name} v{data.version} · © The MITRE Corporation. ATT&amp;CK® is a registered trademark of The MITRE Corporation.
          </Text>
        </>
      )}

      {data && (
        <TechniqueDrawer
          data={data}
          id={openId && data.byId.has(openId) ? openId : null}
          studied={openId ? studied.has(openId) : false}
          onToggleStudied={toggleStudied}
          onOpen={open}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function TechniqueTable({ data, matches, studied, onOpen }) {
  const tacticName = useMemo(() => Object.fromEntries(data.tactics.map((t) => [t.shortname, t.name])), [data]);
  const rows = useMemo(() => {
    const row = (t) => ({ ...t, key: t.id });
    return data.techniques
      .filter((t) => !t.isSub)
      .map((t) => {
        const kids = (data.subs.get(t.id) || []).filter((s) => matches.has(s.id)).map(row);
        if (!matches.has(t.id) && !kids.length) return null;
        return kids.length ? { ...row(t), children: kids } : row(t);
      })
      .filter(Boolean);
  }, [data, matches]);

  return (
    <Table
      size="middle"
      dataSource={rows}
      pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (n) => `${n} techniques` }}
      onRow={(r) => ({ onClick: () => onOpen(r.id), style: { cursor: 'pointer' } })}
      columns={[
        {
          title: 'ID', dataIndex: 'id', width: 130,
          sorter: (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }),
          render: (v) => <Text code>{v}</Text>,
        },
        {
          title: 'Technique', dataIndex: 'name',
          sorter: (a, b) => a.name.localeCompare(b.name),
          render: (v, r) => (
            <Flex gap={6} align="center">
              <Text strong={!r.isSub}>{v}</Text>
              {studied.has(r.id) && <Tooltip title="Studied"><CheckCircleFilled style={{ color: '#17915A' }} /></Tooltip>}
            </Flex>
          ),
        },
        {
          title: 'Tactics', dataIndex: 'tactics', width: 260,
          filters: data.tactics.map((t) => ({ text: t.name, value: t.shortname })),
          onFilter: (v, r) => r.tactics.includes(v),
          render: (v) => <Flex wrap gap={4}>{v.map((s) => <Tag key={s} color="blue" style={{ margin: 0 }}>{tacticName[s]}</Tag>)}</Flex>,
        },
        {
          title: 'Platforms', dataIndex: 'platforms', width: 220, responsive: ['lg'],
          render: (v) => <Text type="secondary" style={{ fontSize: 12.5 }}>{v.join(', ')}</Text>,
        },
        {
          title: 'Detections', key: 'det', width: 110, align: 'center',
          sorter: (a, b) => a.detections.length - b.detections.length,
          render: (_, r) => r.detections.reduce((n, d) => n + d.analytics.length, 0) || '—',
        },
        {
          title: 'Mitigations', key: 'mit', width: 110, align: 'center',
          sorter: (a, b) => a.mitigations.length - b.mitigations.length,
          render: (_, r) => r.mitigations.length || '—',
        },
      ]}
    />
  );
}

export default AttackExplorer;
