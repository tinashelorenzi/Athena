'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Layout, Row, Col, Card, Statistic, Progress, Tag, Button, Typography, Flex, Space, Input, Segmented, Select,
  Empty, Result, Steps, Avatar, Table, Tooltip, theme,
} from 'antd';
import {
  RadarChartOutlined, CheckCircleOutlined, TrophyOutlined, RiseOutlined, ArrowRightOutlined, CaretRightOutlined,
  RocketOutlined, FileSearchOutlined, AlertOutlined, CodeOutlined, PaperClipOutlined, FileTextOutlined,
  AimOutlined, AppstoreOutlined, ClockCircleOutlined, UserAddOutlined, CrownOutlined, SelectOutlined, SendOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { StudentTopBar } from './StudentTopBar';
import { RichText } from '@/components/RichText';
import { TechniqueTags } from '@/components/attack/TechniqueTags';
import { Tour } from '@/components/Tour';
import { initials } from '@/components/shell/SideShell';

const { Title, Text, Paragraph } = Typography;

const DASHBOARD_TOUR = [
  { selector: '[data-tour="hero"]', title: 'Your analyst profile', body: 'Your rank and reputation live here. Finish graded assessments to earn reputation and climb the levels.' },
  { selector: '[data-tour="stats"]', title: 'Your progress', body: 'A quick read on what you have in progress, what you’ve completed, and your average grade.' },
  { selector: '[data-tour="scenarios"]', title: 'Your scenarios', body: 'Everything released to you. Dojos teach you; Assessments are graded. Click a card to enter the lab.' },
  { selector: '[data-tour="capabilities"]', title: 'Inside the lab', body: 'The tools you’ll use on every case — log search, alert triage, OSQuery, EDR and evidence.' },
  { selector: '[data-tour="results"]', title: 'Results & feedback', body: 'Once your instructor releases a grade, your score and their feedback show up here.' },
];

const TYPE_TAG = { DOJO: { color: 'cyan', label: 'Dojo' }, ASSESSMENT: { color: 'purple', label: 'Assessment' } };
const STATUS_META = {
  NOT_STARTED: { color: 'default', label: 'Not started', cta: 'Start' },
  IN_PROGRESS: { color: 'processing', label: 'In progress', cta: 'Continue' },
  COMPLETED: { color: 'blue', label: 'Completed', cta: 'Review' },
  SUBMITTED: { color: 'blue', label: 'Submitted', cta: 'Review' },
  GRADED: { color: 'success', label: 'Graded', cta: 'Review' },
};
const DONE = ['COMPLETED', 'SUBMITTED', 'GRADED'];

const CAPABILITIES = [
  { icon: <FileSearchOutlined />, title: 'Discover logs', desc: 'Hunt through event logs with KQL search and a live histogram — just like Kibana Discover.' },
  { icon: <AlertOutlined />, title: 'Triage alerts', desc: 'Work the alert queue in real time: set a verdict, take notes, and extract IOCs on each case.' },
  { icon: <CodeOutlined />, title: 'EDR & OSQuery', desc: 'Inspect endpoint telemetry and run real SQL against host tables to find what happened.' },
  { icon: <PaperClipOutlined />, title: 'Evidence', desc: 'Download forensic artifacts and dig into the detail behind each incident.' },
  { icon: <FileTextOutlined />, title: 'Report & grade', desc: 'Write up your findings and answer the flags. Your instructor grades and gives feedback.' },
];

const HOW_STEPS = [
  { icon: <SelectOutlined />, title: 'Open a scenario', content: 'Dojos teach you; assessments are graded.' },
  { icon: <RadarChartOutlined />, title: 'Investigate', content: 'Alerts, logs, EDR, OSQuery and artifacts — all in one workspace.' },
  { icon: <SendOutlined />, title: 'Submit', content: 'Answer the flags and write your report to close the case.' },
];

const gradeColor = (g) => (g == null ? 'default' : g >= 75 ? 'success' : g >= 50 ? 'gold' : 'error');

export function StudentHome({ user, scenarios, standing, rank, leaderboard, results = [] }) {
  const stats = useMemo(() => {
    const by = (st) => scenarios.filter((s) => s.status === st).length;
    const inProgress = by('IN_PROGRESS');
    const done = by('COMPLETED') + by('SUBMITTED') + by('GRADED');
    const graded = results.length;
    const withGrade = results.filter((r) => r.grade != null);
    const avg = withGrade.length ? Math.round(withGrade.reduce((a, r) => a + r.grade, 0) / withGrade.length) : null;
    return { inProgress, done, graded, avg };
  }, [scenarios, results]);

  const nextUp = useMemo(
    () => scenarios.find((s) => s.status === 'IN_PROGRESS') || scenarios.find((s) => s.status === 'NOT_STARTED') || null,
    [scenarios],
  );
  const isNew = stats.done === 0;

  return (
    <Layout style={{ height: '100vh' }}>
      <StudentTopBar user={user} />
      <Layout.Content style={{ overflow: 'auto' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
          <Flex vertical gap={20}>
            <div data-tour="hero"><Hero user={user} standing={standing} rank={rank} nextUp={nextUp} /></div>

            <Row data-tour="stats" gutter={[16, 16]}>
              <Col xs={12} md={6}><Card><Statistic title="In progress" value={stats.inProgress} prefix={<RadarChartOutlined />} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="Completed" value={stats.done} prefix={<CheckCircleOutlined />} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="Graded" value={stats.graded} prefix={<TrophyOutlined />} /></Card></Col>
              <Col xs={12} md={6}>
                <Card><Statistic title="Avg. grade" value={stats.avg ?? '—'} suffix={stats.avg != null ? '/ 100' : undefined} prefix={<RiseOutlined />} /></Card>
              </Col>
            </Row>

            {isNew && (
              <Card title="How it works" extra={<Text type="secondary">Three steps to your first solved case</Text>}>
                <Steps items={HOW_STEPS.map((x) => ({ ...x, status: 'process' }))} />
              </Card>
            )}

            <Row gutter={[20, 20]}>
              <Col xs={24} lg={16}>
                <Flex vertical gap={20}>
                  <div data-tour="scenarios"><Catalog scenarios={scenarios} hasCohort={Boolean(user?.cohort)} /></div>
                  {results.length > 0 && <div data-tour="results"><Results results={results} /></div>}
                </Flex>
              </Col>
              <Col xs={24} lg={8}>
                <Flex vertical gap={20}>
                  <AttackCard />
                  <div data-tour="capabilities"><Capabilities /></div>
                  {leaderboard && leaderboard.length > 1 && <Leaderboard rows={leaderboard} meId={user?.id} />}
                </Flex>
              </Col>
            </Row>
          </Flex>
        </div>
      </Layout.Content>
      <Tour steps={DASHBOARD_TOUR} storageKey="athena.tour.dashboard.v1" />
    </Layout>
  );
}

/* ---- Hero: welcome + analyst standing + next-up CTA ---- */
function Hero({ user, standing, rank, nextUp }) {
  const { token } = theme.useToken();
  const s = standing || { reputation: 0, title: 'Recruit', level: 1, floor: 0, nextAt: 100, assessmentsGraded: 0 };
  const span = s.nextAt != null ? s.nextAt - s.floor : 0;
  const pct = s.nextAt != null && span > 0 ? Math.min(100, Math.round(((s.reputation - s.floor) / span) * 100)) : 100;
  const first = (user?.name || 'analyst').split(' ')[0];
  const yellow = 'var(--highlight-yellow, #FFD43B)';
  const white70 = 'rgba(255,255,255,0.75)';
  const inProgress = nextUp?.status === 'IN_PROGRESS';

  return (
    <Card
      variant="borderless"
      style={{ background: `linear-gradient(120deg, ${token.colorPrimary} 0%, #23258F 60%, #15175C 100%)`, overflow: 'hidden' }}
      styles={{ body: { padding: 28 } }}
    >
      <Flex align="center" gap={28} wrap>
        <div style={{ flex: 1, minWidth: 260 }}>
          <Tag variant="filled" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', marginBottom: 12 }}>
            SOC Analyst · {user?.cohort || 'Unassigned'}
          </Tag>
          <Title level={2} style={{ color: '#fff', margin: '0 0 6px' }}>Welcome back, {first}</Title>
          <Paragraph style={{ color: white70, margin: 0, maxWidth: 480 }}>
            You&apos;re a <Text strong style={{ color: '#fff' }}>{s.title}</Text>
            {rank ? <> · ranked <Text strong style={{ color: '#fff' }}>#{rank.rank}</Text> of {rank.total} in your cohort</> : null}. Keep working cases to climb.
          </Paragraph>
          <div style={{ marginTop: 16, maxWidth: 380 }}>
            <Flex justify="space-between">
              <Text style={{ color: white70, fontSize: 12 }}>{s.reputation} rep</Text>
              <Text style={{ color: white70, fontSize: 12 }}>{s.nextAt != null ? `next level at ${s.nextAt}` : 'Max level'}</Text>
            </Flex>
            <Progress percent={pct} showInfo={false} strokeColor={yellow} railColor="rgba(255,255,255,0.18)" />
          </div>
          {nextUp && (
            <Flex align="center" gap={12} wrap style={{ marginTop: 18 }}>
              <Link href={`/learn/${nextUp.id}`}>
                <Button size="large" icon={inProgress ? <CaretRightOutlined /> : <RocketOutlined />} style={{ fontWeight: 600 }}>
                  {inProgress ? 'Continue' : 'Start'}: {nextUp.title}
                </Button>
              </Link>
              <Text style={{ color: white70, fontSize: 12 }}>{inProgress ? 'Pick up where you left off' : 'Your next scenario'}</Text>
            </Flex>
          )}
        </div>
        <Flex vertical align="center" gap={6} style={{ flex: 'none' }}>
          <Progress
            type="dashboard"
            percent={pct}
            size={128}
            strokeColor={yellow}
            railColor="rgba(255,255,255,0.18)"
            format={() => (
              <Flex vertical align="center">
                <span style={{ color: '#fff', fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{s.level || 1}</span>
                <span style={{ color: white70, fontSize: 10, letterSpacing: 1.5, marginTop: 4 }}>LEVEL</span>
              </Flex>
            )}
          />
          <Text strong style={{ color: '#fff' }}>{s.title}</Text>
        </Flex>
      </Flex>
    </Card>
  );
}

/* ---- Scenario catalog with search + type/status filters ---- */
function Catalog({ scenarios, hasCohort }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('ALL');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return scenarios.filter((sc) => {
      if (type !== 'ALL' && sc.type !== type) return false;
      if (status === 'TODO' && sc.status !== 'NOT_STARTED') return false;
      if (status === 'IN_PROGRESS' && sc.status !== 'IN_PROGRESS') return false;
      if (status === 'DONE' && !DONE.includes(sc.status)) return false;
      return !s || `${sc.title} ${sc.description || ''} ${(sc.techniques || []).join(' ')}`.toLowerCase().includes(s);
    });
  }, [scenarios, q, type, status]);

  return (
    <Card
      title={<Space><AppstoreOutlined />Your scenarios</Space>}
      extra={scenarios.length ? <Text type="secondary">{scenarios.length} available</Text> : null}
    >
      {scenarios.length === 0 ? (
        <Result
          icon={hasCohort ? <ClockCircleOutlined /> : <UserAddOutlined />}
          title={hasCohort ? 'No scenarios released yet' : "You're not in a cohort yet"}
          subTitle={hasCohort
            ? "Your instructor hasn't released any scenarios to your cohort yet. As soon as they do, they'll show up here — and you'll get a heads-up when new alerts start firing."
            : 'Ask your instructor to add you to a cohort. Once you’re in, released scenarios will appear here and you can start working real SOC cases.'}
        />
      ) : (
        <Flex vertical gap={16}>
          <Flex gap={12} wrap align="center">
            <Input.Search allowClear placeholder="Search scenarios" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 220px', maxWidth: 320 }} />
            <Segmented
              value={type}
              onChange={setType}
              options={[{ value: 'ALL', label: 'All' }, { value: 'DOJO', label: 'Dojo' }, { value: 'ASSESSMENT', label: 'Assessment' }]}
            />
            <Select
              value={status}
              onChange={setStatus}
              style={{ width: 150 }}
              options={[
                { value: 'ALL', label: 'Any status' },
                { value: 'TODO', label: 'Not started' },
                { value: 'IN_PROGRESS', label: 'In progress' },
                { value: 'DONE', label: 'Done' },
              ]}
            />
          </Flex>
          {filtered.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No scenarios match your filters." />
          ) : (
            <Row gutter={[16, 16]}>
              {filtered.map((s) => <Col key={s.id} xs={24} md={12}><ScenarioCard scenario={s} /></Col>)}
            </Row>
          )}
        </Flex>
      )}
    </Card>
  );
}

function ScenarioCard({ scenario: s }) {
  const st = STATUS_META[s.status] || STATUS_META.NOT_STARTED;
  const tt = TYPE_TAG[s.type] || TYPE_TAG.DOJO;
  return (
    <Card hoverable size="small" style={{ height: '100%' }} styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', gap: 10, padding: 16 } }}>
      <Flex align="center" gap={6}>
        <Tag color={tt.color}>{tt.label}</Tag>
        {s.kind === 'LAB' && (
          <Tooltip title="Done on your own virtual machine">
            <Tag color="purple" icon={<CloudServerOutlined />}>Lab</Tag>
          </Tooltip>
        )}
        <div style={{ flex: 1 }} />
        <Tag color={st.color} style={{ marginInlineEnd: 0 }}>
          {st.label}{s.status === 'GRADED' && s.grade != null ? ` · ${s.grade}` : ''}
        </Tag>
      </Flex>
      <Title level={5} style={{ margin: 0 }}>{s.title}</Title>
      <Paragraph type="secondary" ellipsis={{ rows: 3 }} style={{ margin: 0, flex: 1, fontSize: 13 }}>{s.description || 'No description.'}</Paragraph>
      <TechniqueTags ids={s.techniques} max={4} />
      <Link href={`/learn/${s.id}`}>
        <Button block type={s.status === 'NOT_STARTED' || s.status === 'IN_PROGRESS' ? 'primary' : 'default'} icon={<ArrowRightOutlined />} iconPlacement="end">
          {st.cta}
        </Button>
      </Link>
    </Card>
  );
}

function AttackCard() {
  const { token } = theme.useToken();
  return (
    <Card>
      <Flex gap={14} align="flex-start">
        <Avatar shape="square" size={44} icon={<AimOutlined />} style={{ background: token.colorPrimaryBg, color: token.colorPrimary, flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong style={{ fontSize: 15 }}>MITRE ATT&amp;CK Explorer</Text>
          <Paragraph type="secondary" style={{ fontSize: 13, margin: '4px 0 12px' }}>
            Look up the tactics and techniques behind the alerts you triage — Enterprise and ICS matrices.
          </Paragraph>
          <Link href="/attack"><Button icon={<ArrowRightOutlined />} iconPlacement="end">Open explorer</Button></Link>
        </div>
      </Flex>
    </Card>
  );
}

function Capabilities() {
  const { token } = theme.useToken();
  return (
    <Card title="Inside the lab" extra={<Text type="secondary" style={{ fontSize: 12 }}>Your tools on every case</Text>} styles={{ body: { paddingBlock: 4 } }}>
      {CAPABILITIES.map((c, i) => (
        <Flex key={c.title} gap={12} align="flex-start" style={{ padding: '12px 0', borderTop: i ? `1px solid ${token.colorBorderSecondary}` : 'none' }}>
          <Avatar shape="square" icon={c.icon} style={{ background: token.colorPrimaryBg, color: token.colorPrimary, flex: 'none' }} />
          <div>
            <Text strong>{c.title}</Text>
            <div><Text type="secondary" style={{ fontSize: 12.5 }}>{c.desc}</Text></div>
          </div>
        </Flex>
      ))}
    </Card>
  );
}

function Results({ results }) {
  const columns = [
    { title: 'Type', dataIndex: 'type', key: 'type', width: 120, render: (t) => <Tag color={(TYPE_TAG[t] || TYPE_TAG.DOJO).color}>{(TYPE_TAG[t] || TYPE_TAG.DOJO).label}</Tag> },
    { title: 'Scenario', dataIndex: 'scenarioTitle', key: 'scenarioTitle', ellipsis: true, render: (v) => <Text strong>{v}</Text> },
    { title: 'Released', dataIndex: 'releasedAt', key: 'releasedAt', width: 120, render: (v) => <Text type="secondary">{String(v || '').slice(0, 10)}</Text> },
    { title: 'Grade', dataIndex: 'grade', key: 'grade', width: 110, align: 'right', render: (g) => <Tag color={gradeColor(g)} style={{ marginInlineEnd: 0 }}>{g != null ? `${g} / 100` : '—'}</Tag> },
  ];
  return (
    <Card title={<Space><TrophyOutlined />Results &amp; feedback</Space>} extra={<Text type="secondary">Released by your instructor</Text>} styles={{ body: { padding: 0 } }}>
      <Table
        size="middle"
        rowKey="id"
        columns={columns}
        dataSource={results}
        pagination={false}
        expandable={{
          rowExpandable: (r) => Boolean(r.feedback || r.reportFileName),
          expandRowByClick: true,
          expandedRowRender: (r) => (
            <Flex vertical gap={10}>
              {r.feedback && (
                <div>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Instructor feedback</Text>
                  <div style={{ marginTop: 6 }}><RichText html={r.feedback} /></div>
                </div>
              )}
              {r.reportFileName && (
                <Button type="link" icon={<FileTextOutlined />} href={`/api/submissions/${r.id}/report`} target="_blank" rel="noreferrer" style={{ paddingInline: 0, alignSelf: 'flex-start' }}>
                  Your submitted report ({r.reportFileName})
                </Button>
              )}
            </Flex>
          ),
        }}
      />
    </Card>
  );
}

function Leaderboard({ rows, meId }) {
  const { token } = theme.useToken();
  return (
    <Card title={<Space><CrownOutlined />Cohort standings</Space>} styles={{ body: { paddingBlock: 4 } }}>
      {rows.map((r, i) => {
        const me = r.id === meId;
        return (
          <Flex
            key={r.id}
            align="center"
            gap={10}
            style={{ padding: '10px 8px', borderTop: i ? `1px solid ${token.colorBorderSecondary}` : 'none', ...(me ? { background: token.colorPrimaryBg, borderRadius: token.borderRadius } : null) }}
          >
            <Text strong={i < 3} style={{ width: 22, textAlign: 'center', fontFamily: token.fontFamilyCode, color: i < 3 ? token.colorPrimary : token.colorTextTertiary }}>{i + 1}</Text>
            <Avatar size="small" style={{ background: me ? token.colorPrimary : token.colorTextQuaternary, flex: 'none' }}>{initials(r.name)}</Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text ellipsis>{r.name}{me ? <Text type="secondary"> · you</Text> : null}</Text>
              <div><Text type="secondary" style={{ fontSize: 12 }}>{r.assessments} assessment{r.assessments === 1 ? '' : 's'}</Text></div>
            </div>
            <Text strong style={{ fontFamily: token.fontFamilyCode }}>{r.reputation}</Text>
          </Flex>
        );
      })}
    </Card>
  );
}

export default StudentHome;
