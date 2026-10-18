'use client';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, Button, Card, Col, Empty, List, Progress, Result, Row, Statistic, Table, Typography, theme } from 'antd';
import {
  TeamOutlined, ApartmentOutlined, AppstoreOutlined, InboxOutlined, EyeInvisibleOutlined, EditOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { initials } from '@/components/shell/SideShell';
import { GradeState, Page } from '../settings/parts';

/* Instructor dashboard (client view for the server page at /admin): headline
   stats, the grading work waiting on the instructor, and recent students. */
export function InstructorDashboard({ firstName, counts, stats, attention, recentStudents }) {
  const router = useRouter();
  const { token } = theme.useToken();

  const cards = [
    { key: 'students', title: 'Students', value: counts.students, icon: <TeamOutlined />, hint: 'Enrolled in the lab', href: '/admin/students' },
    { key: 'cohorts', title: 'Cohorts', value: counts.cohorts, icon: <ApartmentOutlined />, hint: 'Active classes', href: '/admin/cohorts' },
    { key: 'scenarios', title: 'Scenarios', value: counts.scenarios, icon: <AppstoreOutlined />, hint: 'Authored' },
    { key: 'grading', title: 'Needs grading', value: stats.needsGrading, icon: <InboxOutlined />, hint: 'Awaiting a grade', href: '/admin/grading', color: stats.needsGrading ? token.colorWarning : undefined },
    { key: 'held', title: 'Held', value: stats.held, icon: <EyeInvisibleOutlined />, hint: 'Graded, not released', href: '/admin/grading', color: stats.held ? token.colorPrimary : undefined },
  ];

  const releasedPct = stats.total ? Math.round((stats.released / stats.total) * 100) : 0;

  return (
    <Page title={`Welcome, ${firstName}`} description="Your SOC lab at a glance.">
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col key={c.key} xs={12} md={8} xl={{ flex: '20%' }}>
            <Card hoverable={Boolean(c.href)} onClick={c.href ? () => router.push(c.href) : undefined} style={{ height: '100%' }}>
              <Statistic title={c.title} value={c.value} prefix={c.icon} styles={{ content: c.color ? { color: c.color } : undefined }} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{c.hint}</Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card
            title="Needs your attention"
            extra={<Link href="/admin/grading"><Button icon={<EditOutlined />}>Open grading queue</Button></Link>}
            styles={{ body: { padding: attention.length ? 0 : undefined } }}
            style={{ height: '100%' }}
          >
            {attention.length === 0 ? (
              <Result status="success" title="All caught up" subTitle="No submissions are waiting to be graded or released." />
            ) : (
              <Table
                rowKey="id"
                dataSource={attention}
                pagination={false}
                onRow={() => ({ onClick: () => router.push('/admin/grading'), style: { cursor: 'pointer' } })}
                columns={[
                  { title: 'Student', dataIndex: 'studentName', key: 'studentName', render: (v) => <Typography.Text strong>{v}</Typography.Text> },
                  { title: 'Cohort', dataIndex: 'cohortName', key: 'cohortName', width: 150 },
                  { title: 'Scenario', dataIndex: 'scenarioTitle', key: 'scenarioTitle' },
                  { title: 'Submitted', dataIndex: 'submitted', key: 'submitted', width: 110, render: (v) => v.slice(0, 10) },
                  { title: 'State', key: 'state', width: 150, render: (_v, row) => <GradeState row={row} /> },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card title="Grading progress">
                <Progress percent={releasedPct} success={{ percent: releasedPct }} format={() => `${stats.released}/${stats.total}`} />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Submissions graded and released to students</Typography.Text>
              </Card>
            </Col>
            <Col span={24}>
              <Card
                title="Recently added students"
                extra={<Link href="/admin/students"><Button type="link" style={{ padding: 0 }}>Manage</Button></Link>}
              >
                <List
                  dataSource={recentStudents}
                  locale={{
                    emptyText: (
                      <Empty description="No students yet">
                        <Link href="/admin/students"><Button type="primary" icon={<UserAddOutlined />}>Add students</Button></Link>
                      </Empty>
                    ),
                  }}
                  renderItem={(s) => (
                    <List.Item extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>{s.added}</Typography.Text>}>
                      <List.Item.Meta
                        avatar={<Avatar style={{ background: token.colorPrimaryBg, color: token.colorPrimary }}>{initials(s.name)}</Avatar>}
                        title={s.name}
                        description={s.email}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </Page>
  );
}

export default InstructorDashboard;
