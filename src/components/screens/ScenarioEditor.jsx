'use client';
import React, { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  App, Button, Card, Col, Descriptions, Divider, Empty, Flex, Input, List, Popconfirm, Row, Tag, Typography,
} from 'antd';
import {
  PlayCircleOutlined, DeleteOutlined, CheckOutlined, DatabaseOutlined, LinkOutlined, DesktopOutlined,
  CloudServerOutlined, PaperClipOutlined, PlusOutlined, EyeInvisibleOutlined,
} from '@ant-design/icons';
import { updateScenarioBasics, deleteScenario, saveEndpoint, removeEndpoint } from '@/app/actions/scenarios';
import { ScenarioFields, Field } from './scenarios/ScenarioFields';
import { JsonField } from './scenarios/JsonField';
import { GuideUploader } from './scenarios/GuideUploader';
import { FileField, FormLayout, FormStatus, Page, SectionHeader, TypeTag } from './settings/parts';

export function ScenarioEditor({ scenario, endpoints }) {
  const { message } = App.useApp();
  const [state, action, saving] = useActionState(updateScenarioBasics.bind(null, scenario.id), {});
  const onError = (e) => message.error(e);

  return (
    <Page
      back="/admin/scenarios"
      title={scenario.title}
      tags={<>
        <TypeTag type={scenario.type} />
        {scenario.hidden && <Tag icon={<EyeInvisibleOutlined />}>Hidden</Tag>}
      </>}
      description={<Typography.Text type="secondary" code copyable={{ text: scenario.id }}>{scenario.id}</Typography.Text>}
      maxWidth={960}
      extra={<>
        <Link href={`/admin/scenarios/${scenario.id}/preview`}><Button icon={<PlayCircleOutlined />}>Preview</Button></Link>
        <Popconfirm
          title="Delete scenario?"
          description={`"${scenario.title}" and all its endpoints/artifacts will be permanently removed.`}
          okText="Delete scenario"
          okButtonProps={{ danger: true }}
          onConfirm={() => deleteScenario(scenario.id)}
        >
          <Button danger icon={<DeleteOutlined />}>Delete</Button>
        </Popconfirm>
      </>}
    >
      {scenario.refToken && <ReferenceLink token={scenario.refToken} />}

      <form action={action}>
        <Flex vertical gap={16}>
          <ScenarioFields mode="edit" initial={scenario} />
          <Card size="small">
            <Flex align="center" justify="flex-end" gap={12} wrap>
              <div style={{ flex: 1, minWidth: 200 }}><FormStatus state={state} /></div>
              <Button type="primary" htmlType="submit" loading={saving} icon={<CheckOutlined />}>Save changes</Button>
            </Flex>
          </Card>
        </Flex>
      </form>

      {/* Raw data status */}
      <Card title={<SectionHeader icon={<DatabaseOutlined />} title="SOC data bundles" subtitle="Set at creation." />}>
        <Descriptions column={{ xs: 1, sm: 2 }} items={[
          { key: 'logs', label: 'Logs', children: <Tag color={scenario.hasLogs ? 'success' : 'default'}>{scenario.hasLogs ? 'Present' : 'None'}</Tag> },
          { key: 'alerts', label: 'Alerts', children: <Tag color={scenario.hasAlerts ? 'success' : 'default'}>{scenario.hasAlerts ? 'Present' : 'None'}</Tag> },
        ]} />
      </Card>

      <GuideUploader scenarioId={scenario.id} guide={scenario.guideStatus} preview={scenario.guidePreview} />

      <EndpointsManager scenarioId={scenario.id} endpoints={endpoints} onError={onError} />
    </Page>
  );
}

function EndpointsManager({ scenarioId, endpoints, onError }) {
  const [state, action, saving] = useActionState(saveEndpoint.bind(null, scenarioId), {});
  const [busyId, setBusyId] = useState(null);

  const onRemove = async (ep) => {
    setBusyId(ep.id);
    const res = await removeEndpoint(ep.id);
    setBusyId(null);
    if (res?.error) onError(res.error);
  };

  return (
    <Card title={<SectionHeader icon={<DesktopOutlined />} title="Endpoints" subtitle="EDR + OSQuery data and evidence artifacts, per host." />}>
      <List
        bordered
        dataSource={endpoints}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No endpoints yet. Add one below." /> }}
        renderItem={(ep) => (
          <List.Item
            actions={[
              <Popconfirm key="rm" title={`Remove ${ep.hostname}?`} okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => onRemove(ep)}>
                <Button type="text" danger aria-label="Remove endpoint" loading={busyId === ep.id} icon={<DeleteOutlined />} />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              avatar={<CloudServerOutlined style={{ fontSize: 18, marginTop: 4 }} />}
              title={<Typography.Text code>{ep.hostname}</Typography.Text>}
              description={
                <Flex gap={4} wrap>
                  <Tag color={ep.hasEdr ? 'success' : 'default'}>EDR</Tag>
                  <Tag color={ep.hasOsquery ? 'success' : 'default'}>OSQuery</Tag>
                  {ep.artifactName && <Tag color="blue" icon={<PaperClipOutlined />}>{ep.artifactName}</Tag>}
                </Flex>
              }
            />
          </List.Item>
        )}
      />

      <Divider titlePlacement="start" plain>Add / update endpoint</Divider>

      <form action={action}>
        <FormLayout>
          <Field label="Hostname" required hint="Saving an existing hostname updates that endpoint.">
            <Input name="hostname" required placeholder="win-ep-04" prefix={<CloudServerOutlined />} />
          </Field>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <JsonField label="EDR sample (JSON)" name="edr" example="edr" rows={4} placeholder='{ "hostname": "win-ep-04", "processes": [] }' />
            </Col>
            <Col xs={24} lg={12}>
              <JsonField label="OSQuery data (JSON)" name="osquery" example="osquery" rows={4} placeholder='{ "hostname": "win-ep-04", "tables": {} }' />
            </Col>
          </Row>
          <Field label="Evidence artifact (ZIP, optional)" hint="Requires object storage configured in Settings → Storage.">
            <FileField name="artifact" accept=".zip,application/zip" label="Select .zip" />
          </Field>
          <Flex align="center" justify="flex-end" gap={12} wrap>
            <div style={{ flex: 1, minWidth: 200 }}><FormStatus state={state} /></div>
            <Button htmlType="submit" loading={saving} icon={<PlusOutlined />}>Save endpoint</Button>
          </Flex>
        </FormLayout>
      </form>
    </Card>
  );
}

function ReferenceLink({ token }) {
  const path = `/s/${token}`;
  const fullUrl = () => (typeof window !== 'undefined' ? window.location.origin : '') + path;
  return (
    <Card size="small">
      <Flex align="center" gap={12} wrap>
        <LinkOutlined />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text strong>Reference link</Typography.Text>
          <div><Typography.Text type="secondary" style={{ fontSize: 12.5 }}>Embed in the LMS / learning materials — students land straight in this scenario.</Typography.Text></div>
        </div>
        <Typography.Text code copyable={{ text: fullUrl, tooltips: ['Copy link', 'Copied'] }}>{path}</Typography.Text>
      </Flex>
    </Card>
  );
}

export default ScenarioEditor;
