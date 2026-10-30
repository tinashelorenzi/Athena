'use client';
import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Flex, Steps, Typography, Upload, theme } from 'antd';
import { FolderOpenOutlined, LoadingOutlined, DownloadOutlined, ApartmentOutlined } from '@ant-design/icons';
import { autoBuildScenario } from '@/app/actions/autobuild';
import { filesFromInput, buildFolderFormData } from './scenarios/folderUpload';
import { Page, SectionHeader } from './settings/parts';
import { LabGateReport } from './labs/LabGateReport';

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

const LAB_LAYOUT = `my-lab/
  scenario.json        # { "kind": "LAB", "slug": "p21-web", ... }
  brief.md             # may use {{param.token}} and {{script.setup}}
  scripts/
    setup.sh           # optional: students run it with the curl command
                       # the brief shows ({{param.x}} filled in per student)
    files/
      logs.json        # optional: big files scripts download ({{file.logs_json}})
  lab/
    lab.yaml           # roles, params, collect, parse, checks
    assets/…           # files sent to the machine (pcaps, fixtures)
  reference/
    good.evidence.json     # from the answer-key machine: must score 100%
                           # (leave out to upload a draft and capture it from a session)
    broken.evidence.json   # optional: must fail…
    broken.expect.json     # …the checks listed here`;

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
      // Labs stay on the page so the gate report can be read; SOC scenarios open straight away.
      if (res?.scenarioId && res?.ok && !res.lab) router.push(`/admin/scenarios/${res.scenarioId}`);
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
          {status?.ok && !status.lab && <Alert type="success" showIcon title={`${status.ok} Redirecting…`} />}
          {status?.ok && status.lab && (
            <Alert
              type="success"
              showIcon
              title={status.ok}
              action={<Link href={`/admin/scenarios/${status.scenarioId}`}><Button size="small" type="primary">Open the lab</Button></Link>}
            />
          )}
          {status?.lab && <LabGateReport report={status.lab} />}
        </Flex>
      </Card>

      <Card
        title={<SectionHeader icon={<ApartmentOutlined />} title="Folder layout" />}
        extra={<a href="/api/examples/autobuild-bundle"><Button icon={<DownloadOutlined />}>Download example</Button></a>}
      >
        <Typography.Text strong>SOC scenario</Typography.Text>
        <pre style={{ margin: '6px 0 16px', padding: '12px 14px', borderRadius: token.borderRadius, background: token.colorFillQuaternary, fontFamily: token.fontFamilyCode, fontSize: 12.5, lineHeight: 1.6, color: token.colorTextSecondary, overflow: 'auto' }}>{LAYOUT}</pre>
        <Typography.Text strong>Lab (graded on the student&apos;s own machines)</Typography.Text>
        <pre style={{ margin: '6px 0 0', padding: '12px 14px', borderRadius: token.borderRadius, background: token.colorFillQuaternary, fontFamily: token.fontFamilyCode, fontSize: 12.5, lineHeight: 1.6, color: token.colorTextSecondary, overflow: 'auto' }}>{LAB_LAYOUT}</pre>
        <Typography.Paragraph type="secondary" style={{ margin: '12px 0 0' }}>
          Full spec + examples: <Typography.Text code>docs/autobuild.md</Typography.Text> and <Typography.Text code>docs/labs/</Typography.Text> (example lab: <Typography.Text code>docs/examples/lab-p21-web</Typography.Text>). Works for both Dojo and Assessment.
        </Typography.Paragraph>
      </Card>
    </Page>
  );
}

export default AutoBuilder;
