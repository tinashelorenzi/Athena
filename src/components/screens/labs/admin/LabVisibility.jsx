'use client';
import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, App, Card, Col, Flex, Row, Select, Switch, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { setLabCohorts, setLabVisibility } from '@/app/actions/lab-admin';

const { Text } = Typography;

/* Who sees a lab: exposure, hidden (Dojos) and the cohorts it is released to.
   Set here, not in scenario.json — re-uploading a new version keeps these. */
export function LabVisibility({ scenario, cohorts, released, studentUrl }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [exposure, setExposure] = useState(scenario.exposure);
  const [hidden, setHidden] = useState(scenario.hidden);
  const [cohortIds, setCohortIds] = useState(released);

  const saveVisibility = (nextExposure, nextHidden) => {
    setExposure(nextExposure);
    setHidden(nextHidden);
    start(async () => {
      const res = await setLabVisibility(scenario.id, nextExposure, nextHidden);
      if (res?.error) { message.error(res.error); return; }
      message.success('Visibility saved');
      router.refresh();
    });
  };

  const saveCohorts = (ids) => {
    setCohortIds(ids);
    start(async () => {
      const res = await setLabCohorts(scenario.id, ids);
      if (res?.error) { message.error(res.error); return; }
      message.success(ids.length ? `Released to ${ids.length} cohort${ids.length === 1 ? '' : 's'}` : 'Not released to any cohort');
      router.refresh();
    });
  };

  const isDojo = scenario.type === 'DOJO';
  const n = cohortIds.length;
  const cohortText = `students in the ${n} released cohort${n === 1 ? '' : 's'}`;
  // Mirrors getStudentScenarios: a cohort release always lists the lab; hidden only affects Public.
  let summary;
  if (exposure === 'PUBLIC' && !(isDojo && hidden)) summary = 'Listed for every student.';
  else if (exposure === 'PUBLIC') summary = n ? `Listed for ${cohortText}; any other student can open it by direct link.` : 'Not listed; any student can open it by direct link.';
  else summary = n ? `Listed for ${cohortText}. Nobody else can open it.` : 'Nobody can see it yet: release it to a cohort, or make it Public.';

  return (
    <Card size="small" title={<Flex gap={8} align="center"><EyeOutlined /> Who can see this lab</Flex>}>
      <Row gutter={[16, 12]}>
        <Col xs={24} md={6}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Exposure</Text>
          <Select
            style={{ width: '100%' }}
            value={exposure}
            disabled={pending}
            onChange={(v) => saveVisibility(v, hidden)}
            options={[{ value: 'ROLLOUT', label: 'Rollout (released cohorts)' }, { value: 'PUBLIC', label: 'Public (every student)' }]}
          />
        </Col>
        <Col xs={24} md={12}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
            Released to cohorts{exposure === 'PUBLIC' && ' (not needed while Public)'}
          </Text>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Pick cohorts"
            value={cohortIds}
            disabled={pending}
            onChange={saveCohorts}
            optionFilterProp="label"
            options={cohorts.map((c) => ({ value: c.id, label: c.name }))}
            notFoundContent={<Text type="secondary">No cohorts yet. <Link href="/admin/cohorts">Create one</Link></Text>}
          />
        </Col>
        <Col xs={24} md={6}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Hidden</Text>
          <Flex gap={8} align="center" style={{ minHeight: 32 }}>
            <Switch checked={isDojo && hidden} disabled={!isDojo || exposure !== 'PUBLIC' || pending} onChange={(v) => saveVisibility(exposure, v)} />
            <Text type="secondary" style={{ fontSize: 12 }}>{!isDojo ? 'Dojos only' : exposure === 'PUBLIC' ? 'Unlisted, direct link only' : 'Only for Public labs'}</Text>
          </Flex>
        </Col>
      </Row>
      <Alert
        style={{ marginTop: 12 }}
        type={exposure === 'ROLLOUT' && !n ? 'warning' : 'info'}
        showIcon
        title={summary}
        description={<>Student link: <Text copyable code>{studentUrl}</Text></>}
      />
    </Card>
  );
}
