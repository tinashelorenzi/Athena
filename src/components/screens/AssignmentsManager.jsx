'use client';
import React, { useState, useMemo, useTransition } from 'react';
import {
  Alert, App, Avatar, Button, Card, Col, DatePicker, Empty, Flex, Form, List, Modal, Popconfirm, Row, Table, Tag,
  Tooltip, Typography,
} from 'antd';
import { UserAddOutlined, ClockCircleOutlined, CloseOutlined, ProfileOutlined } from '@ant-design/icons';
import { assignScenario, unassignScenario } from '@/app/actions/assignments';
import { SEVERITY } from '@/theme/antdTheme';
import { initials } from '@/components/shell/SideShell';
import { FormLayout, Page } from './settings/parts';

const STATUS_META = {
  ASSIGNED: { color: 'blue', label: 'Assigned' },
  IN_PROGRESS: { color: 'purple', label: 'In progress' },
  COMPLETED: { color: 'success', label: 'Completed' },
};

/* Assignment Scenarios: browse the scenario catalog and assign scenarios to
   students. Data comes from the server page; mutations are Server Actions that
   revalidate this route. */
export function AssignmentsManager({ scenarios, students, assignments }) {
  const { message } = App.useApp();
  const [assignFor, setAssignFor] = useState(null); // scenario being assigned
  const [busyId, setBusyId] = useState(null); // assignment id being removed

  // scenarioId -> assignment rows
  const byScenario = useMemo(() => {
    const map = {};
    for (const a of assignments) (map[a.scenarioId] ||= []).push(a);
    return map;
  }, [assignments]);

  const onRemove = async (assignment) => {
    setBusyId(assignment.id);
    const res = await unassignScenario(assignment.id);
    setBusyId(null);
    if (res?.error) message.error(res.error);
  };

  return (
    <Page
      title="Assignment Scenarios"
      description={`${scenarios.length} scenarios · ${students.length} ${students.length === 1 ? 'student' : 'students'} · ${assignments.length} active ${assignments.length === 1 ? 'assignment' : 'assignments'}`}
    >
      {students.length === 0 && (
        <Alert type="info" showIcon title="No students to assign yet" description="Add students on the Students page before assigning scenarios." />
      )}

      <Row gutter={[16, 16]}>
        {scenarios.map((sc) => {
          const rows = byScenario[sc.id] || [];
          const sev = SEVERITY[sc.color] || SEVERITY.info;
          return (
            <Col key={sc.id} xs={24} md={12} xl={8}>
              <Card
                style={{ height: '100%' }}
                styles={{ body: { display: 'flex', flexDirection: 'column', gap: 12, height: '100%' } }}
              >
                <div>
                  <Flex align="center" gap={8} style={{ marginBottom: 6 }}>
                    <Tag color={sev.color}>{sev.label}</Tag>
                    <Typography.Text type="secondary" code>{sc.id}</Typography.Text>
                  </Flex>
                  <Typography.Title level={5} style={{ margin: 0 }}>{sc.title}</Typography.Title>
                </div>

                <Flex wrap gap={4}>
                  <Tag>{sc.difficulty}</Tag>
                  <Tag icon={<ClockCircleOutlined />}>{sc.mins}m</Tag>
                  <Tag>{sc.tag}</Tag>
                </Flex>

                <Typography.Paragraph type="secondary" ellipsis={{ rows: 3, tooltip: sc.desc }} style={{ margin: 0, flex: 1 }}>{sc.desc}</Typography.Paragraph>

                <div>
                  <Flex align="center" justify="space-between" style={{ marginBottom: rows.length ? 4 : 0 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {rows.length ? `Assigned · ${rows.length}` : 'Not assigned'}
                    </Typography.Text>
                    <Button size="small" icon={<UserAddOutlined />} disabled={students.length === 0} onClick={() => setAssignFor(sc)}>
                      Assign
                    </Button>
                  </Flex>
                  {rows.length > 0 && (
                    <List
                      size="small"
                      split={false}
                      dataSource={rows}
                      renderItem={(a) => (
                        <List.Item
                          style={{ paddingInline: 0 }}
                          actions={[
                            <Popconfirm key="rm" title={`Unassign ${a.student.name}?`} okText="Unassign" onConfirm={() => onRemove(a)}>
                              <Tooltip title="Unassign">
                                <Button type="text" size="small" aria-label="Unassign" disabled={busyId === a.id} icon={<CloseOutlined />} />
                              </Tooltip>
                            </Popconfirm>,
                          ]}
                        >
                          <List.Item.Meta
                            avatar={<Avatar size="small">{initials(a.student.name)}</Avatar>}
                            title={<Typography.Text ellipsis style={{ fontWeight: 400 }}>{a.student.name}</Typography.Text>}
                          />
                          <Tag color={STATUS_META[a.status]?.color}>{STATUS_META[a.status]?.label || a.status}</Tag>
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      <AssignDialog
        key={assignFor ? assignFor.id : 'none'}
        scenario={assignFor}
        students={students}
        assignedIds={assignFor ? new Set((byScenario[assignFor.id] || []).map((a) => a.student.id)) : new Set()}
        onClose={() => setAssignFor(null)}
        onError={(e) => message.error(e)}
      />
    </Page>
  );
}

function AssignDialog({ scenario, students, assignedIds, onClose, onError }) {
  const [selected, setSelected] = useState([]);
  const [due, setDue] = useState(null); // dayjs | null
  const [pending, startTransition] = useTransition();
  if (!scenario) return null;

  const assignable = students.filter((s) => !assignedIds.has(s.id));

  const submit = () => {
    if (selected.length === 0) { onError('Select at least one student.'); return; }
    startTransition(async () => {
      const res = await assignScenario(scenario.id, [...selected], due ? due.format('YYYY-MM-DD') : null);
      if (res?.error) { onError(res.error); return; }
      onClose();
    });
  };

  const toggle = (id) => setSelected((p) => (p.includes(id) ? p.filter((k) => k !== id) : [...p, id]));

  return (
    <Modal
      open
      width={640}
      title={<Flex align="center" gap={8}><ProfileOutlined />{`Assign · ${scenario.title}`}</Flex>}
      onCancel={onClose}
      onOk={submit}
      okText={`Assign${selected.length ? ` (${selected.length})` : ''}`}
      okButtonProps={{ disabled: assignable.length === 0 }}
      confirmLoading={pending}
    >
      <Typography.Paragraph type="secondary">Select the students who should receive this scenario.</Typography.Paragraph>
      <Flex vertical gap={16}>
        <Table
          size="small"
          rowKey="id"
          dataSource={students}
          pagination={false}
          scroll={{ y: 280 }}
          rowSelection={{
            selectedRowKeys: [...selected, ...assignedIds],
            onChange: (keys) => setSelected(keys.filter((k) => !assignedIds.has(k))),
            getCheckboxProps: (row) => ({ disabled: assignedIds.has(row.id) }),
          }}
          onRow={(row) => ({
            onClick: () => { if (!assignedIds.has(row.id)) toggle(row.id); },
            style: { cursor: assignedIds.has(row.id) ? 'default' : 'pointer' },
          })}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No students." /> }}
          columns={[
            {
              title: 'Student', dataIndex: 'name', key: 'name',
              render: (v, row) => (
                <Flex align="center" gap={8}>
                  <Avatar size="small">{initials(v)}</Avatar>
                  <div style={{ minWidth: 0 }}>
                    <div>{v}</div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.email}</Typography.Text>
                  </div>
                </Flex>
              ),
            },
            {
              title: '', key: 'state', width: 140, align: 'right',
              render: (_v, row) => (assignedIds.has(row.id) ? <Tag>Already assigned</Tag> : null),
            },
          ]}
        />
        {assignable.length === 0 && <Alert type="info" showIcon title="Every student already has this scenario." />}
        <FormLayout>
          <Form.Item label="Due date (optional)" style={{ marginBottom: 0 }}>
            <DatePicker value={due} onChange={setDue} style={{ width: 220 }} />
          </Form.Item>
        </FormLayout>
      </Flex>
    </Modal>
  );
}

export default AssignmentsManager;
