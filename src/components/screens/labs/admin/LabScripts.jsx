'use client';
import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, Divider, Empty, Flex, Input, Modal, Popconfirm, Tag, Typography, Upload } from 'antd';
import { DeleteOutlined, DownloadOutlined, EditOutlined, FileOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { StackList } from '@/components/ds/StackList';
import { deleteLabFile, deleteLabScript, saveLabScript, uploadLabFile } from '@/app/actions/lab-admin';

const { Text, Paragraph } = Typography;

const download = (name, content) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/x-shellscript' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.sh` });
  a.click();
  URL.revokeObjectURL(url);
};

/* A lab's scripts: shell scripts the brief hands to students as a curl
   command ({{script.<name>}}), each student getting their own short link with
   their values filled in. Folder uploads add/update scripts/*.sh; here they can
   also be typed, uploaded one at a time, or deleted. Below them, the files
   scripts can download ({{file.<name>}}). See docs/labs/scripts.md. */
export function LabScripts({ labId, scripts, params, files = [] }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(null); // { name, content, create }
  const [error, setError] = useState(null);

  const open = (s) => { setError(null); setEditing(s ? { name: s.name, content: s.content, create: false } : { name: '', content: '#!/usr/bin/env bash\nset -euo pipefail\n\n', create: true }); };

  const save = () => start(async () => {
    const res = await saveLabScript(labId, editing.name, editing.content, editing.create);
    if (res?.error) { setError(res.error); return; }
    message.success(`Saved ${editing.name.replace(/\.sh$/, '')}.sh`);
    setEditing(null);
    router.refresh();
  });

  const remove = (name) => start(async () => {
    const res = await deleteLabScript(labId, name);
    if (res?.error) { message.error(res.error); return; }
    message.success(`Deleted ${name}.sh`);
    router.refresh();
  });

  const readFile = (file) => {
    file.text().then((content) => setEditing((e) => ({
      ...e,
      content,
      name: e.create && !e.name ? file.name.replace(/\.sh$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '-') : e.name,
    })));
    return false; // read it here; don't upload anywhere
  };

  return (
    <Flex vertical gap={12}>
      <Flex justify="space-between" align="center" gap={12} wrap>
        <Paragraph type="secondary" style={{ margin: 0, maxWidth: 720 }}>
          Put <Text code>{'{{script.<name>}}'}</Text> in the brief and each student sees{' '}
          <Text code>{'curl -fsSL <their link> | sudo bash'}</Text> with their own values filled into the script.
          Use <Text code>{'{{script.<name>.url}}'}</Text> for just the link.
        </Paragraph>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open(null)}>Add script</Button>
      </Flex>

      {scripts.length ? (
        <StackList
          items={scripts}
          rowKey={(s) => s.name}
          renderItem={(s) => (
            <Flex justify="space-between" align="center" gap={12} wrap>
              <Flex vertical gap={2}>
                <Flex gap={8} align="center" wrap>
                  <Text strong>{s.name}.sh</Text>
                  <Text code copyable>{`{{script.${s.name}}}`}</Text>
                  {s.inBrief ? <Tag color="green" style={{ margin: 0 }}>in the brief</Tag> : <Tag color="warning" style={{ margin: 0 }}>not in the brief</Tag>}
                </Flex>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {s.content.split('\n').length} lines · updated {new Date(s.updatedAt).toLocaleString()} · {s.links} student link{s.links === 1 ? '' : 's'}
                </Text>
              </Flex>
              <Flex gap={6}>
                <Button size="small" icon={<EditOutlined />} onClick={() => open(s)}>Edit</Button>
                <Button size="small" icon={<DownloadOutlined />} onClick={() => download(s.name, s.content)} aria-label={`Download ${s.name}.sh`} />
                <Popconfirm
                  title={`Delete ${s.name}.sh?`}
                  description="Students' links to it stop working."
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove(s.name)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} disabled={pending} aria-label={`Delete ${s.name}.sh`} />
                </Popconfirm>
              </Flex>
            </Flex>
          )}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<>No scripts. Add one here, or put <Text code>scripts/&lt;name&gt;.sh</Text> in the lab folder.</>} />
      )}

      <Modal
        open={Boolean(editing)}
        title={editing?.create ? 'Add a script' : `Edit ${editing?.name}.sh`}
        width={820}
        okText="Save"
        confirmLoading={pending}
        onOk={save}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        {editing && (
          <Flex vertical gap={10}>
            <Flex gap={8} align="center" wrap>
              <Input
                style={{ maxWidth: 260 }}
                suffix={<Text type="secondary">.sh</Text>}
                placeholder="setup"
                value={editing.name}
                disabled={!editing.create}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
              <Upload accept=".sh,text/x-shellscript,text/plain" showUploadList={false} beforeUpload={readFile}>
                <Button icon={<UploadOutlined />}>Load from a file</Button>
              </Upload>
            </Flex>
            <Input.TextArea
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              autoSize={{ minRows: 14, maxRows: 28 }}
              spellCheck={false}
              style={{ fontFamily: 'var(--ath-font-family-code)', fontSize: 12.5 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Runs as root on the student&rsquo;s machine. Placeholders filled in per student:{' '}
              {params.length ? params.map((p) => <Text key={p} code style={{ fontSize: 12 }}>{`{{param.${p}}}`}</Text>) : 'none (the lab has no parameters)'}
              {files.length > 0 && <>. Download links to the lab&rsquo;s files: {files.map((f) => <Text key={f.name} code style={{ fontSize: 12 }}>{`{{file.${f.name}}}`}</Text>)}</>}
            </Text>
            {!editing.create && <Text type="secondary" style={{ fontSize: 12 }}>Changes apply straight away to every student&rsquo;s link. Re-uploading a folder with scripts/{editing.name}.sh replaces this text.</Text>}
            {error && <Alert type="error" showIcon title={error} />}
          </Flex>
        )}
      </Modal>

      <Divider style={{ margin: '8px 0 0' }} />
      <LabFiles labId={labId} files={files} />
    </Flex>
  );
}

const size = (n) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/* Files a lab's scripts download: {{file.<name>}} in a script becomes a link
   through the student's own script link. For anything too big to put in a
   script (log dumps, archives). Folder uploads add/update scripts/files/*. */
function LabFiles({ labId, files }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, start] = useTransition();

  const upload = (file) => {
    start(async () => {
      const fd = new FormData();
      fd.append('labId', labId);
      fd.append('file', file);
      const res = await uploadLabFile(fd);
      if (res?.error) { message.error(res.error); return; }
      message.success(`Uploaded ${file.name}: use {{file.${res.name}}} in a script`);
      router.refresh();
    });
    return false;
  };

  const remove = (f) => start(async () => {
    const res = await deleteLabFile(labId, f.name);
    if (res?.error) { message.error(res.error); return; }
    message.success(`Deleted ${f.filename}`);
    router.refresh();
  });

  return (
    <Flex vertical gap={12}>
      <Flex justify="space-between" align="center" gap={12} wrap>
        <Flex vertical gap={2} style={{ maxWidth: 720 }}>
          <Text strong>Files for scripts</Text>
          <Text type="secondary">
            Too big for a script, like a JSON log dump? Upload it here and put <Text code>{'{{file.<name>}}'}</Text> in a script:
            each student&rsquo;s copy gets a download link through their own script link, e.g.{' '}
            <Text code>{'curl -fsSL {{file.logs_json}} -o /tmp/logs.json'}</Text>. Up to 95 MB each.
          </Text>
        </Flex>
        <Upload showUploadList={false} beforeUpload={upload} multiple={false}>
          <Button icon={<UploadOutlined />} loading={pending}>Upload file</Button>
        </Upload>
      </Flex>
      {files.length ? (
        <StackList
          items={files}
          rowKey={(f) => f.name}
          renderItem={(f) => (
            <Flex justify="space-between" align="center" gap={12} wrap>
              <Flex vertical gap={2}>
                <Flex gap={8} align="center" wrap>
                  <FileOutlined />
                  <Text strong>{f.filename}</Text>
                  <Text code copyable>{`{{file.${f.name}}}`}</Text>
                  {f.usedBy.length ? <Tag color="green" style={{ margin: 0 }}>used by {f.usedBy.map((n) => `${n}.sh`).join(', ')}</Tag> : <Tag color="warning" style={{ margin: 0 }}>no script uses it</Tag>}
                </Flex>
                <Text type="secondary" style={{ fontSize: 12 }}>{size(f.size)} · updated {new Date(f.updatedAt).toLocaleString()}</Text>
              </Flex>
              <Flex gap={6}>
                <Upload showUploadList={false} beforeUpload={(file) => upload(new File([file], f.filename, { type: file.type }))}>
                  <Button size="small" icon={<UploadOutlined />} disabled={pending}>Replace</Button>
                </Upload>
                <Popconfirm
                  title={`Delete ${f.filename}?`}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove(f)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} disabled={pending} aria-label={`Delete ${f.filename}`} />
                </Popconfirm>
              </Flex>
            </Flex>
          )}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<>No files. Upload one here, or put it in the lab folder&rsquo;s <Text code>scripts/files/</Text>.</>} />
      )}
    </Flex>
  );
}

export default LabScripts;
