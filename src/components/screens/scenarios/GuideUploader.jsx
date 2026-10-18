'use client';
import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Divider, Flex, Popconfirm, Tag, Typography, Upload } from 'antd';
import { ReadOutlined, EyeOutlined, EyeInvisibleOutlined, DeleteOutlined, FolderOpenOutlined, LoadingOutlined } from '@ant-design/icons';
import { uploadGuide, removeGuide } from '@/app/actions/guide';
import { filesFromInput, buildFolderFormData } from './folderUpload';
import { GuidePreview } from './GuidePreview';
import { SectionHeader } from '../settings/parts';

/* Drag-and-drop (or pick) a folder containing main.md + image assets. main.md is
   parsed for ```prompt blocks; images are uploaded to storage and served to
   students via /api/scenarios/[id]/guide/. Upload.Dragger in `directory` mode
   walks dropped folders and stamps each file's webkitRelativePath, so the
   folderUpload helpers build the same { path, file } FormData as before. */
export function GuideUploader({ scenarioId, guide, preview }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [status, setStatus] = useState(null); // { ok } | { error }
  const [showPreview, setShowPreview] = useState(false);

  const submit = (fileEntries) => {
    if (!fileEntries.length) { setStatus({ error: 'No files found in that drop.' }); return; }
    setStatus(null);
    start(async () => {
      const res = await uploadGuide(scenarioId, buildFolderFormData(fileEntries));
      setStatus(res);
      if (res?.ok) router.refresh();
    });
  };

  // Called once per file with the whole batch; submit on the first call only.
  const beforeUpload = (file, list) => {
    if (file === list[0]) submit(filesFromInput(list));
    return Upload.LIST_IGNORE;
  };

  const onRemove = () => {
    setStatus(null);
    start(async () => { const res = await removeGuide(scenarioId); if (!res?.error) router.refresh(); else setStatus(res); });
  };

  return (
    <Card
      title={<SectionHeader icon={<ReadOutlined />} title="Learning guide" subtitle={<>Drop a folder with <Typography.Text code>main.md</Typography.Text> + images. Use ```prompt blocks for CTF questions.</>} />}
      extra={
        <Flex gap={4}>
          {guide?.has && preview && (
            <Button type="text" icon={showPreview ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? 'Hide preview' : 'Preview'}
            </Button>
          )}
          {guide?.has && (
            <Popconfirm title="Remove the learning guide?" description="Students will no longer see it." okText="Remove" okButtonProps={{ danger: true }} onConfirm={onRemove}>
              <Button type="text" danger loading={busy} icon={<DeleteOutlined />}>Remove</Button>
            </Popconfirm>
          )}
        </Flex>
      }
    >
      <Flex vertical gap={12}>
        {guide?.has && (
          <Flex gap={4} wrap>
            <Tag color="success">Guide uploaded</Tag>
            <Tag>{guide.promptCount} prompt{guide.promptCount === 1 ? '' : 's'}</Tag>
            <Tag>{guide.assetCount} asset{guide.assetCount === 1 ? '' : 's'}</Tag>
          </Flex>
        )}

        <Upload.Dragger directory multiple showUploadList={false} disabled={busy} beforeUpload={beforeUpload}>
          <p className="ant-upload-drag-icon">{busy ? <LoadingOutlined /> : <FolderOpenOutlined />}</p>
          <p className="ant-upload-text">{busy ? 'Uploading…' : guide?.has ? 'Drop a folder to replace the guide' : 'Drag a guide folder here'}</p>
          <p className="ant-upload-hint">or click to choose a folder</p>
        </Upload.Dragger>

        {status?.error && <Alert type="error" showIcon title={status.error} />}
        {status?.ok && <Alert type="success" showIcon title={status.ok} />}

        {showPreview && preview && (
          <>
            <Divider titlePlacement="start" plain style={{ margin: '4px 0' }}>Student view · answers revealed</Divider>
            <GuidePreview scenarioId={scenarioId} markdown={preview.markdown} prompts={preview.prompts} />
          </>
        )}
      </Flex>
    </Card>
  );
}

export default GuideUploader;
