'use client';
import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, Empty, Flex, Modal, Radio, Switch, Table, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { applyLabRegrade, previewLabRegrade } from '@/app/actions/lab-admin';

const { Text, Paragraph } = Typography;

/* Re-grade finished sessions from their stored evidence: with each session's
   own lab version (picks up parser fixes), or with the latest version (after
   fixing a check). Always previewed as a diff before anything is saved. */
export function RegradeButton({ labId, latestVersion }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<ReloadOutlined />} onClick={() => setOpen(true)}>Re-grade…</Button>
      {open && <RegradeDialog labId={labId} latestVersion={latestVersion} onClose={() => setOpen(false)} />}
    </>
  );
}

function RegradeDialog({ labId, latestVersion, onClose }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [target, setTarget] = useState('own');
  const [diff, setDiff] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [pending, start] = useTransition();

  const preview = (t = target) => start(async () => {
    const res = await previewLabRegrade(labId, t);
    if (res?.error) message.error(res.error);
    else setDiff(res);
  });
  const apply = () => start(async () => {
    const res = await applyLabRegrade(labId, target);
    if (res?.error) { message.error(res.error); return; }
    message.success(`Re-graded: ${res.changed} session${res.changed === 1 ? '' : 's'} changed`);
    router.refresh();
    onClose();
  });

  const changed = diff?.filter((d) => d.changed) ?? [];
  const rows = showAll ? diff ?? [] : changed;

  return (
    <Modal
      open
      width={880}
      title="Re-grade finished sessions"
      onCancel={onClose}
      footer={
        <Flex justify="space-between" align="center">
          <Text type="secondary">{diff ? `${changed.length} of ${diff.length} would change` : 'Preview first — nothing is saved until you apply.'}</Text>
          <Flex gap={8}>
            <Button onClick={onClose}>Cancel</Button>
            <Button onClick={() => preview()} loading={pending && !diff}>Preview</Button>
            <Button type="primary" danger disabled={!diff || changed.length === 0} loading={pending && Boolean(diff)} onClick={apply}>
              Apply to {changed.length} session{changed.length === 1 ? '' : 's'}
            </Button>
          </Flex>
        </Flex>
      }
    >
      <Flex vertical gap={14}>
        <Radio.Group
          value={target}
          onChange={(e) => { setTarget(e.target.value); setDiff(null); }}
          options={[
            { value: 'own', label: 'With each session’s own version (current parsers)' },
            { value: 'latest', label: `With the latest version (v${latestVersion})` },
          ]}
        />
        <Paragraph type="secondary" style={{ margin: 0 }}>
          Grading reruns on the evidence each session collected, so nothing is asked of students’ machines. With the latest
          version, items a newer version collects but the session didn’t are “not collected”. Score overrides are kept, and
          grades already released stay as they are.
        </Paragraph>
        {diff && (
          <>
            <Flex gap={6} align="center"><Switch size="small" checked={showAll} onChange={setShowAll} /><Text>Show unchanged sessions too</Text></Flex>
            {rows.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing would change." />
            ) : (
              <Table
                size="small"
                rowKey="sessionId"
                dataSource={rows}
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                expandable={{
                  rowExpandable: (r) => r.checks.length > 0,
                  expandedRowRender: (r) => (
                    <Flex vertical gap={2}>
                      {r.checks.map((c) => (
                        <Text key={c.id} style={{ fontSize: 13 }}>
                          {c.title}: {c.oldPoints ?? '—'}/{c.oldMax ?? '—'} → <Text strong>{c.newPoints}/{c.newMax}</Text>
                          {c.newReason && <Text type="secondary"> ({c.newReason})</Text>}
                        </Text>
                      ))}
                    </Flex>
                  ),
                }}
                columns={[
                  { title: 'Student', dataIndex: 'student' },
                  { title: 'Session', key: 'v', width: 110, render: (_, r) => `v${r.version}${r.gradedWith !== r.version ? ` → v${r.gradedWith}` : ''}` },
                  {
                    title: 'Score', key: 's', width: 160,
                    render: (_, r) => (
                      <Text>
                        {r.oldScore ?? '—'}/{r.oldMax ?? '—'} → <Text strong type={r.newScore < (r.oldScore ?? 0) ? 'danger' : r.newScore > (r.oldScore ?? 0) ? 'success' : undefined}>{r.newScore}/{r.newMax}</Text>
                      </Text>
                    ),
                  },
                  {
                    title: 'Flags', key: 'f',
                    render: (_, r) => (r.oldFlags.join() === r.newFlags.join()
                      ? <Text type="secondary">{r.newFlags.join(', ') || '—'}</Text>
                      : <Flex gap={4} wrap>{r.newFlags.filter((f) => !r.oldFlags.includes(f)).map((f) => <Tag key={f} color="red">+{f}</Tag>)}{r.oldFlags.filter((f) => !r.newFlags.includes(f)).map((f) => <Tag key={f}>−{f}</Tag>)}</Flex>),
                  },
                  { title: '', key: 'o', width: 100, render: (_, r) => (r.overridden ? <Tag color="gold">overridden</Tag> : null) },
                ]}
              />
            )}
            {changed.some((d) => d.overridden) && <Alert type="info" showIcon title="Overridden sessions keep their instructor score; their computed score is updated underneath." />}
          </>
        )}
      </Flex>
    </Modal>
  );
}

export default RegradeButton;
