'use client';
import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Flex, Steps, Typography, Upload, theme } from 'antd';
import { FolderOpenOutlined, LoadingOutlined, DownloadOutlined, ApartmentOutlined } from '@ant-design/icons';
import { autoBuildScenario } from '@/app/actions/autobuild';
import { filesFromInput, buildFolderFormData } from './scenarios/folderUpload';
import { Page, SectionHeader } from './settings/parts';

const LAYOUT = `my-scenario/
  scenario.json        # manifest (required)
  brief.md             # markdown briefing
  logs.json            # { version, entries: [...] }
  alerts.json          # { version, alerts: [{ seek, ... }] }
  guide/
    main.md            # teaching guide (with \`\`\`prompt blocks)
    images/…
  endpoints/
    win-ep-04/
      edr.json
      osquery.json
      evidence.zip     # optional artifact`;

/* Auto-builder: drop one folder (scenario.json manifest + brief/guide/logs/
   alerts/endpoints) and the whole scenario is created in one shot.
   Upload.Dragger in `directory` mode walks the dropped folder and stamps each
   file's webkitRelativePath, which the folderUpload helpers turn into the same
   { files, paths } FormData the action expects. */
export function AutoBuilder() {
  const router = useRouter();
  const { token } = theme.useToken();
  const [busy, start] = useTransition();
  const [status, setStatus] = useState(null); // { ok, scenarioId } | { error, scenarioId? }

  const submit = (entries) => {
    if (!entries.length) { setStatus({ error: 'No files found in that drop.' }); return; }
    setStatus(null);
    start(async () => {
      const res = await autoBuildScenario(buildFolderFormData(entries));
      setStatus(res);
      if (res?.scenarioId && res?.ok) router.push(`/admin/scenarios/${res.scenarioId}`);
    });
  };

  // Called once per file with the whole batch; submit on the first call only.
  const beforeUpload = (file, list) => {
    if (file === list[0]) submit(filesFromInput(list));
    return Upload.LIST_IGNORE;
  };

  const current = busy ? 1 : status?.ok ? 2 : status?.error ? 1 : 0;

  return (
    <Page
      back="/admin/scenarios"
      title="Auto-build a scenario"
      description={<>Drop a folder with a <Typography.Text code>scenario.json</Typography.Text> manifest and its files.</>}
      maxWidth={860}
    >
      <Card>
        <Flex vertical gap={20}>
          <Steps
            current={current}
            status={status?.error ? 'error' : busy ? 'process' : status?.ok ? 'finish' : 'process'}
            items={[
              { title: 'Drop folder', content: 'Manifest + files' },
              { title: 'Build', content: busy ? 'Creating scenario…' : 'Validate & import', icon: busy ? <LoadingOutlined /> : undefined },
              { title: 'Review', content: 'Open the new scenario' },
            ]}
          />

          <Upload.Dragger directory multiple showUploadList={false} disabled={busy} beforeUpload={beforeUpload}>
            <p className="ant-upload-drag-icon">{busy ? <LoadingOutlined /> : <FolderOpenOutlined />}</p>
            <p className="ant-upload-text">{busy ? 'Building scenario…' : 'Drag a scenario folder here'}</p>
            <p className="ant-upload-hint">or click to choose a folder</p>
          </Upload.Dragger>

          {status?.error && (
            <Alert
              type="error"
              showIcon
              title={status.error}
              action={status.scenarioId ? <Link href={`/admin/scenarios/${status.scenarioId}`}><Button size="small">Open the scenario</Button></Link> : null}
            />
          )}
          {status?.ok && <Alert type="success" showIcon title={`${status.ok} Redirecting…`} />}
        </Flex>
      </Card>

      <Card
        title={<SectionHeader icon={<ApartmentOutlined />} title="Folder layout" />}
        extra={<a href="/api/examples/autobuild-bundle"><Button icon={<DownloadOutlined />}>Download example</Button></a>}
      >
        <pre style={{ margin: 0, padding: '12px 14px', borderRadius: token.borderRadius, background: token.colorFillQuaternary, fontFamily: token.fontFamilyCode, fontSize: 12.5, lineHeight: 1.6, color: token.colorTextSecondary, overflow: 'auto' }}>{LAYOUT}</pre>
        <Typography.Paragraph type="secondary" style={{ margin: '12px 0 0' }}>
          Full spec + example: <Typography.Text code>docs/autobuild.md</Typography.Text>. Works for both Dojo and Assessment scenarios.
        </Typography.Paragraph>
      </Card>
    </Page>
  );
}

export default AutoBuilder;
