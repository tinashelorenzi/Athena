'use client';
import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Empty, Form, Input, Modal, Table, Typography } from 'antd';
import { PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { createCohort } from '@/app/actions/cohorts';
import { FormLayout, Page } from './settings/parts';

export function CohortsList({ cohorts }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [creating, startCreate] = useTransition();

  const openCreate = () => { setError(null); setName(''); setOpen(true); };

  const submit = () => {
    setError(null);
    startCreate(async () => {
      const res = await createCohort(name);
      if (res?.error) { setError(res.error); return; }
      setOpen(false);
      setName('');
      router.push(`/admin/cohorts/${res.cohort.id}`);
    });
  };

  const columns = [
    {
      title: 'Cohort', dataIndex: 'name', key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v) => <Typography.Text strong>{v}</Typography.Text>,
    },
    { title: 'Students', dataIndex: 'students', key: 'students', align: 'right', width: 120, sorter: (a, b) => a.students - b.students },
    { title: 'Scenarios', dataIndex: 'scenarios', key: 'scenarios', align: 'right', width: 120, sorter: (a, b) => a.scenarios - b.scenarios },
    { title: 'Created', dataIndex: 'created', key: 'created', align: 'right', width: 130, sorter: (a, b) => a.created.localeCompare(b.created) },
  ];

  return (
    <Page
      title="Cohorts"
      description={`${cohorts.length} ${cohorts.length === 1 ? 'cohort' : 'cohorts'} · groups of students`}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New cohort</Button>}
    >
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={cohorts}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          onRow={(row) => ({ onClick: () => router.push(`/admin/cohorts/${row.id}`), style: { cursor: 'pointer' } })}
          locale={{
            emptyText: (
              <Empty description="No cohorts yet — create one, then add or invite students into it.">
                <Button type="primary" onClick={openCreate}>New cohort</Button>
              </Empty>
            ),
          }}
        />
      </Card>

      <Modal
        open={open}
        title="New cohort"
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Create cohort"
        confirmLoading={creating}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">Name the class or group (e.g. “Cyber Bootcamp — Sept 2026”).</Typography.Paragraph>
        <FormLayout>
          <Form.Item label="Cohort name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} onPressEnter={submit} placeholder="Cyber Bootcamp — Sept 2026" prefix={<TeamOutlined />} autoFocus />
          </Form.Item>
        </FormLayout>
        {error && <Alert type="error" showIcon title={error} />}
      </Modal>
    </Page>
  );
}

export default CohortsList;
