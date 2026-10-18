'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Empty, Flex, Input, Table, Tooltip, Typography } from 'antd';
import { PlusOutlined, CodeSandboxOutlined, SearchOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { Page, TypeTag, TYPE_META } from './settings/parts';

/* Scenario authoring index: list + entry to the create / auto-build flows. */
export function ScenariosList({ scenarios }) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? scenarios.filter((s) => s.title.toLowerCase().includes(q)) : scenarios;
  }, [scenarios, query]);

  const columns = [
    {
      title: 'Title', dataIndex: 'title', key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (v, row) => (
        <Flex align="center" gap={8}>
          <Typography.Text strong>{v}</Typography.Text>
          {row.hidden && <Tooltip title="Hidden — direct link only"><EyeInvisibleOutlined style={{ opacity: 0.55 }} /></Tooltip>}
        </Flex>
      ),
    },
    {
      title: 'Type', dataIndex: 'type', key: 'type', width: 140,
      filters: Object.entries(TYPE_META).map(([value, m]) => ({ text: m.label, value })),
      onFilter: (value, row) => row.type === value,
      render: (v) => <TypeTag type={v} />,
    },
    {
      title: 'Exposure', dataIndex: 'exposure', key: 'exposure', width: 130,
      filters: [{ text: 'Public', value: 'PUBLIC' }, { text: 'Rollout', value: 'ROLLOUT' }],
      onFilter: (value, row) => row.exposure === value,
      render: (v) => <Badge status={v === 'PUBLIC' ? 'success' : 'default'} text={v === 'PUBLIC' ? 'Public' : 'Rollout'} />,
    },
    { title: 'Endpoints', dataIndex: 'endpoints', key: 'endpoints', width: 110, align: 'right', sorter: (a, b) => a.endpoints - b.endpoints },
    {
      title: 'Updated', dataIndex: 'updated', key: 'updated', width: 130, align: 'right',
      sorter: (a, b) => a.updated.localeCompare(b.updated), defaultSortOrder: 'descend',
    },
  ];

  return (
    <Page
      title="Scenarios"
      description={`${scenarios.length} authored · Dojos and Assessments`}
      extra={<>
        <Input allowClear prefix={<SearchOutlined />} placeholder="Search titles…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 220 }} />
        <Link href="/admin/scenarios/auto"><Button icon={<CodeSandboxOutlined />}>Auto-build</Button></Link>
        <Link href="/admin/scenarios/new"><Button type="primary" icon={<PlusOutlined />}>New scenario</Button></Link>
      </>}
    >
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          onRow={(row) => ({ onClick: () => router.push(`/admin/scenarios/${row.id}`), style: { cursor: 'pointer' } })}
          locale={{
            emptyText: (
              <Empty description={scenarios.length === 0 ? 'No scenarios yet — author your first Dojo or Assessment.' : 'No scenarios match.'}>
                {scenarios.length === 0 && <Link href="/admin/scenarios/new"><Button type="primary">New scenario</Button></Link>}
              </Empty>
            ),
          }}
        />
      </Card>
    </Page>
  );
}

export default ScenariosList;
