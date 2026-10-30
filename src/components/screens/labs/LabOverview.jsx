'use client';
import React from 'react';
import Link from 'next/link';
import {
  Alert, Badge, Button, Card, Col, Descriptions, Dropdown, Empty, Flex, Row, Statistic, Table, Tabs, Tag, Timeline, Tooltip, Typography,
} from 'antd';
import {
  CloudServerOutlined, CodeOutlined, ExperimentOutlined, EyeInvisibleOutlined, FileTextOutlined, HistoryOutlined,
  SafetyCertificateOutlined, UploadOutlined, EditOutlined, DownloadOutlined, TeamOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { Markdown } from '@/components/Markdown';
import { osName } from '@/lib/labs/os';
import { StackList } from '@/components/ds/StackList';
import { TechniqueTags } from '@/components/attack/TechniqueTags';
import { Page, TypeTag } from '../settings/parts';
import { LabGateReport } from './LabGateReport';
import { LabSessions } from './admin/LabSessions';
import { RegradeButton } from './admin/RegradeDialog';
import { LabVisibility } from './admin/LabVisibility';
import { LabScripts } from './admin/LabScripts';

const { Text, Paragraph } = Typography;

const itemSummary = (it) => {
  switch (it.kind) {
    case 'run': return it.argv.join(' ');
    case 'file': return it.path;
    case 'glob': return `${it.pattern}${it.content ? ' (with content)' : ''}`;
    case 'service': return it.unit;
    case 'package': return it.names.join(', ');
    case 'log': return `${it.path} (new lines)`;
    default: return '';
  }
};

/* Instructor view of a LAB scenario: what the lab collects and checks, how its
   reference evidence graded, and its version history. Labs are edited by
   re-uploading the folder (Autobuilder) — each upload is a new version. */
export function LabOverview({ scenario, labId, slug, definition, gate, assets, versions, sessions = [], visibility, scripts = [], params = [], files = [] }) {
  const lab = definition;
  const current = versions[0];
  const accepted = versions.find((v) => !v.draft);
  const flagged = sessions.filter((s) => s.flags.length).length;
  return (
    <Page
      back="/admin/scenarios"
      title={scenario.title}
      tags={<><Tag color="purple">Lab</Tag><TypeTag type={scenario.type} />{scenario.hidden && <Tooltip title="Hidden — direct link only"><EyeInvisibleOutlined /></Tooltip>}</>}
      description={<>Slug <Text code>{slug}</Text> · {scenario.exposure === 'PUBLIC' ? 'Public' : 'Rollout'} · version {versions[0]?.version ?? '—'}</>}
      extra={
        <>
          {lab && <Link href={`/admin/scenarios/${scenario.id}/editor`}><Button icon={<EditOutlined />}>Check editor</Button></Link>}
          {lab && accepted && <RegradeButton labId={labId} latestVersion={accepted.version} />}
          {sessions.length > 0 && (
            <Dropdown
              menu={{
                items: [
                  { key: 'latest', label: <a href={`/admin/labs/${labId}/export?scope=latest`}>Latest finished session per student</a> },
                  { key: 'all', label: <a href={`/admin/labs/${labId}/export?scope=all`}>Every session</a> },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>Export CSV</Button>
            </Dropdown>
          )}
          <Link href="/admin/scenarios/auto"><Button icon={<UploadOutlined />}>Upload a new version</Button></Link>
        </>
      }
    >
      {current?.draft && <DraftNotice version={current.version} accepted={accepted?.version} studentUrl={visibility?.studentUrl} />}
      {visibility && <LabVisibility scenario={scenario} {...visibility} />}
      {!lab ? (
        <Card><Empty description="This lab has no version yet." /></Card>
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Max score" value={lab.maxScore} prefix={<SafetyCertificateOutlined />} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Checks" value={lab.checks.length} suffix={<Text type="secondary" style={{ fontSize: 13 }}>{lab.checks.filter((c) => c.flag).length} flag</Text>} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Machines" value={Object.keys(lab.machines).length} prefix={<CloudServerOutlined />} /></Card></Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="Reference" value={gate?.good ? `${gate.good.score}/${gate.good.maxScore}` : '—'} styles={{ content: { color: gate?.good && gate.good.score === gate.good.maxScore ? 'var(--ath-color-success)' : undefined } }} />
              </Card>
            </Col>
          </Row>

          <Card styles={{ body: { paddingTop: 4 } }}>
            <Tabs
              items={[
                {
                  key: 'sessions',
                  label: <span><TeamOutlined /> Sessions <Badge count={flagged} size="small" offset={[4, -2]} title={`${flagged} flagged`} /></span>,
                  children: <LabSessions sessions={sessions} definition={lab} />,
                },
                { key: 'checks', label: <span><SafetyCertificateOutlined /> Checks</span>, children: <ChecksTable lab={lab} /> },
                { key: 'collect', label: <span><CodeOutlined /> Collection</span>, children: <CollectionView lab={lab} assets={assets} /> },
                { key: 'gate', label: <span><ExperimentOutlined /> Reference gate</span>, children: <Flex vertical gap={12}><ReferenceDownloads labId={labId} version={current?.version} gate={gate} />{gate ? <LabGateReport report={{ errors: [], warnings: gate.warnings ?? [], gate }} /> : <Empty />}</Flex> },
                { key: 'brief', label: <span><FileTextOutlined /> Brief</span>, children: <BriefView scenario={scenario} hasRef={Boolean(gate?.referenceParams)} hasScripts={scripts.some((s) => s.inBrief)} /> },
                { key: 'scripts', label: <span><ThunderboltOutlined /> Scripts{scripts.length ? ` (${scripts.length})` : ''}</span>, children: <LabScripts labId={labId} scripts={scripts} params={params} files={files} /> },
                { key: 'versions', label: <span><HistoryOutlined /> Versions</span>, children: <VersionList versions={versions} /> },
              ]}
            />
          </Card>
        </>
      )}
    </Page>
  );
}

/* A draft has no good reference yet: say how to capture one from a real machine. */
function DraftNotice({ version, accepted, studentUrl }) {
  return (
    <Alert
      type="warning"
      showIcon
      title={`Version ${version} is a draft: ${accepted ? `students keep using version ${accepted}` : 'students can\x27t see or start this lab yet'}`}
      description={
        <ol style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>
          <li>Build a VM from your answer key and link it under <Link href="/machines">My machines</Link>.</li>
          <li>Open the lab as a student would{studentUrl ? <> (<Link href={new URL(studentUrl).pathname}>open it</Link>)</> : null}, click <b>Start</b>, then <b>End</b> once it&rsquo;s set up.</li>
          <li>Under <b>Sessions</b> below, open that session and choose <b>Save as good reference</b>. If it scores full marks, this version goes live.</li>
        </ol>
      }
    />
  );
}

function ReferenceDownloads({ labId, version, gate }) {
  const files = [
    gate?.good && 'good.evidence.json',
    gate?.broken && 'broken.evidence.json',
    gate?.broken && 'broken.expect.json',
  ].filter(Boolean);
  if (!files.length) return null;
  return (
    <Flex gap={8} wrap align="center">
      <Text type="secondary">Reference files for your lab folder&rsquo;s <Text code>reference/</Text>:</Text>
      {files.map((f) => (
        <Button key={f} size="small" icon={<DownloadOutlined />} href={`/admin/labs/${labId}/reference/${f}?v=${version}`}>{f}</Button>
      ))}
    </Flex>
  );
}

function ChecksTable({ lab }) {
  return (
    <Table
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={lab.checks}
      expandable={{
        expandedRowRender: (c) => (
          <Flex vertical gap={6} style={{ padding: '4px 8px' }}>
            {c.when && <Text type="secondary">Only when: <Text code>{c.when}</Text></Text>}
            {c.assertions.map((a, i) => (
              <Flex key={i} gap={8} align="baseline">
                {c.mode === 'partial' && <Tag style={{ margin: 0 }}>{a.points} pts</Tag>}
                <Flex vertical gap={0}>
                  {c.mode === 'partial' && <Text>{a.label}</Text>}
                  <Text code style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{a.expr}</Text>
                </Flex>
              </Flex>
            ))}
            {c.hint && <Text type="secondary">Hint shown on failure: “{c.hint}”</Text>}
          </Flex>
        ),
      }}
      columns={[
        {
          title: 'Check', dataIndex: 'title',
          render: (v, c) => (
            <Flex vertical gap={0}>
              <Text>{v}</Text>
              <Text type="secondary" style={{ fontSize: 12, fontFamily: 'var(--ath-font-family-code)' }}>{c.id}</Text>
            </Flex>
          ),
        },
        {
          title: 'Scoring', key: 's', width: 170,
          render: (_, c) => (c.flag
            ? <Tag color="warning">flag {c.flag}</Tag>
            : <Text>{c.points} pts{c.mode === 'partial' ? ` · ${c.assertions.length} parts` : c.assertions.length > 1 ? ` · all of ${c.assertions.length}` : ''}</Text>),
        },
        { title: 'Shown to', dataIndex: 'visibility', width: 110, render: (v) => (v === 'instructor' ? <Tag>instructor only</Tag> : <Text type="secondary">student</Text>) },
      ]}
    />
  );
}

function CollectionView({ lab, assets }) {
  const params = Object.entries(lab.params);
  return (
    <Flex vertical gap={16}>
      <Descriptions
        size="small"
        bordered
        column={1}
        items={[
          {
            key: 'machines', label: 'Machines',
            children: Object.entries(lab.machines).map(([role, m]) => (
              <div key={role}><Text strong>{role}</Text> — {osName(m.os)} {m.versions.join(' / ') || 'any version'}{m.packages.length ? ` · needs ${m.packages.join(', ')}` : ''}</div>
            )),
          },
          {
            key: 'params', label: 'Per-student values',
            children: params.length ? params.map(([n, p]) => (
              <div key={n}><Text code>{n}</Text> {p.type}{p.type === 'token' ? ` ×${p.length}` : p.type === 'int' ? ` ${p.min}–${p.max}` : ` of ${p.values.length}`}{p.unique ? ' · unique in cohort' : ''}</div>
            )) : <Text type="secondary">none</Text>,
          },
          {
            key: 'session', label: 'Session',
            children: (
              <>
                {lab.session.timeLimitMinutes ? `${lab.session.timeLimitMinutes} min limit` : 'no time limit'}
                {' · '}{lab.session.checks.practice ? `practice checks (max ${lab.session.checks.maxPractice}, ${lab.session.checks.cooldownSeconds}s apart)` : 'no practice checks'}
                {' · '}results: {lab.session.checks.showResults}
                {lab.lifecycle.lockdown && <> · <Tag color="red" style={{ margin: 0 }}>SSH off during session</Tag></>}
              </>
            ),
          },
          { key: 'caps', label: 'Agent needs', children: lab.capabilities.map((c) => <Tag key={c}>{c}</Tag>) },
          {
            key: 'assets', label: 'Assets',
            children: assets.length ? assets.map((a) => <div key={a.name}><Text code>{`{{asset.${a.name}}}`}</Text> {a.file} · {a.size} B</div>) : <Text type="secondary">none</Text>,
          },
        ]}
      />
      {lab.collect.map((step, i) => (
        <Card key={i} size="small" title={<Flex gap={8} align="center">Step {i + 1} on <Tag color="blue" style={{ margin: 0 }}>{step.on}</Tag>{step.when !== 'always' && <Tag style={{ margin: 0 }}>{step.when} runs only</Tag>}</Flex>}>
          <StackList
            items={step.gather}
            rowKey={(g) => g.name}
            renderItem={({ name, item: it }) => (
              <>
                <Flex gap={10} align="baseline" wrap>
                  <Text code>{name}</Text>
                  <Tag style={{ margin: 0 }}>{it.kind}</Tag>
                  <Text style={{ fontFamily: 'var(--ath-font-family-code)', fontSize: 12.5 }}>{itemSummary(it)}</Text>
                  {Object.entries(lab.parse).filter(([, p]) => p.item === name).map(([pn, p]) => (
                    <Text key={pn} type="secondary" style={{ fontSize: 12 }}>→ <Text code>{pn}</Text> via {p.parser}</Text>
                  ))}
                </Flex>
              </>
            )}
          />
        </Card>
      ))}
    </Flex>
  );
}

function BriefView({ scenario, hasRef, hasScripts }) {
  return (
    <Flex vertical gap={12}>
      {scenario.description && <Paragraph type="secondary" style={{ margin: 0 }}>{scenario.description}</Paragraph>}
      {scenario.techniques?.length > 0 && <TechniqueTags ids={scenario.techniques} />}
      {hasRef && <Alert type="info" showIcon title="Placeholders are filled with the reference machine's values; each student sees their own." />}
      {hasScripts && <Alert type="info" showIcon title="Script commands here are your own links: running one gets your values. Each student sees their own link." />}
      <Card size="small"><Markdown>{scenario.brief || '_No brief._'}</Markdown></Card>
    </Flex>
  );
}

function VersionList({ versions }) {
  return (
    <Timeline
      items={versions.map((v, i) => ({
        color: v.draft ? 'gold' : i === 0 ? 'green' : 'gray',
        children: (
          <Flex gap={8} align="center" wrap>
            <Text strong>Version {v.version}</Text>
            {v.draft ? <Tag color="gold" style={{ margin: 0 }}>draft</Tag> : v.version === versions.find((x) => !x.draft)?.version && <Tag color="green" style={{ margin: 0 }}>students use this</Tag>}
            <Text type="secondary">{new Date(v.createdAt).toLocaleString()}</Text>
            {v.score != null && <Text type="secondary">· reference {v.score}/{v.maxScore}</Text>}
          </Flex>
        ),
      }))}
    />
  );
}

export default LabOverview;
