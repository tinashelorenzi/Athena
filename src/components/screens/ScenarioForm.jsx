'use client';
import React, { useActionState } from 'react';
import Link from 'next/link';
import { Button, Card, Flex } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { createScenario } from '@/app/actions/scenarios';
import { ScenarioFields } from './scenarios/ScenarioFields';
import { FormStatus, Page } from './settings/parts';

/* New scenario authoring form. On success the action redirects to the new
   scenario's detail page (where endpoints/artifacts are added). */
export function ScenarioForm() {
  const [state, action, saving] = useActionState(createScenario, {});

  return (
    <Page
      back="/admin/scenarios"
      title="New scenario"
      description="Author a Dojo (teaching) or Assessment (graded) scenario. Endpoints and the learning guide are added after creating."
      maxWidth={960}
    >
      <form action={action}>
        <Flex vertical gap={16}>
          <ScenarioFields mode="create" />
          <Card size="small">
            <Flex align="center" justify="flex-end" gap={12} wrap>
              <div style={{ flex: 1, minWidth: 200 }}><FormStatus state={state} /></div>
              <Link href="/admin/scenarios"><Button>Cancel</Button></Link>
              <Button type="primary" htmlType="submit" loading={saving} icon={<CheckOutlined />}>Create scenario</Button>
            </Flex>
          </Card>
        </Flex>
      </form>
    </Page>
  );
}

export default ScenarioForm;
