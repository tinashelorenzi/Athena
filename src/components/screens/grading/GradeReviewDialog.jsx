'use client';
import React, { useState } from 'react';
import {
  Alert, Button, Card, Descriptions, Drawer, Flex, Form, InputNumber, List, Space, Tag, Typography, theme,
} from 'antd';
import {
  LockOutlined, UnlockOutlined, EyeInvisibleOutlined, EyeOutlined, SendOutlined, CheckCircleFilled,
  CloseCircleFilled, FileTextOutlined, DownloadOutlined, ThunderboltOutlined, EditOutlined,
} from '@ant-design/icons';
import { gradeSubmission, setGradeReleased, setSubmissionCommitted } from '@/app/actions/grading';
import { RichTextEditor } from '@/components/RichText';
import { FormLayout } from '../settings/parts';

/* Review a student's submission: see flag correctness + report, set/amend a
   grade + feedback, then release it to the student (or hold it). Shared by the
   cross-cohort grading queue and the per-cohort grading tab. Key this by the
   submission id at the call site so it re-initialises per submission. */
export function GradeReviewDialog({ submission, onClose, onError, onDone }) {
  const { token } = theme.useToken();
  // Prefill with the committed grade if graded, else the flag auto-mark. The
  // instructor validates/overrides before releasing.
  const initialGrade = submission?.grade != null ? submission.grade : submission?.autoGrade;
  const [grade, setGrade] = useState(initialGrade != null ? String(initialGrade) : '');
  const [feedback, setFeedback] = useState(submission?.feedback || '');
  const [busy, setBusy] = useState(false);
  if (!submission) return null;

  const released = submission.released;
  const graded = submission.status === 'GRADED';
  const committed = submission.committed;
  const hasAuto = submission.autoGrade != null;
  const finish = () => { onDone?.(); onClose(); };

  const save = async (release) => {
    setBusy(true);
    const res = await gradeSubmission(submission.id, Number(grade), feedback, release);
    setBusy(false);
    if (res?.error) { onError?.(res.error); return; }
    finish();
  };
  const toggleRelease = async (next) => {
    setBusy(true);
    const res = await setGradeReleased(submission.id, next);
    setBusy(false);
    if (res?.error) { onError?.(res.error); return; }
    finish();
  };
  const setCommitted = async (next) => {
    setBusy(true);
    const res = await setSubmissionCommitted(submission.id, next);
    setBusy(false);
    if (res?.error) { onError?.(res.error); return; }
    finish();
  };

  const flags = submission.flagReview || [];
  const correct = flags.filter((f) => f.correct).length;

  return (
    <Drawer
      open
      size={720}
      title={`Review — ${submission.studentName}`}
      onClose={onClose}
      destroyOnHidden
      footer={
        <Flex justify="flex-end" gap={8} wrap>
          <Button onClick={onClose}>Cancel</Button>
          {!committed && (
            <Button loading={busy} icon={<LockOutlined />} onClick={() => setCommitted(true)}>Commit for grading</Button>
          )}
          {committed && !released && (
            <Button type="text" loading={busy} icon={<UnlockOutlined />} onClick={() => setCommitted(false)}>Re-open</Button>
          )}
          {graded && released && (
            <Button loading={busy} icon={<EyeInvisibleOutlined />} onClick={() => toggleRelease(false)}>Hold</Button>
          )}
          <Button loading={busy} onClick={() => save(false)}>Save (hold)</Button>
          <Button type="primary" loading={busy} icon={<SendOutlined />} onClick={() => save(true)}>{released ? 'Save & keep released' : 'Save & release'}</Button>
        </Flex>
      }
    >
      <Flex vertical gap={16}>
        <Descriptions
          size="small"
          bordered
          column={{ xs: 1, sm: 2 }}
          items={[
            { key: 'scenario', label: 'Scenario', children: submission.scenarioTitle, span: 2 },
            ...(submission.cohortName ? [{ key: 'cohort', label: 'Cohort', children: submission.cohortName }] : []),
            { key: 'submitted', label: 'Submitted', children: String(submission.submitted || '').slice(0, 10) },
            {
              key: 'lock', label: 'Lock',
              children: committed ? <Tag icon={<LockOutlined />} color="default">Committed</Tag> : <Tag icon={<EditOutlined />} color="warning">Open for re-do</Tag>,
            },
            {
              key: 'vis', label: 'Visibility',
              children: released
                ? <Tag icon={<EyeOutlined />} color="success">Released</Tag>
                : graded ? <Tag icon={<EyeInvisibleOutlined />} color="purple">Held</Tag> : <Tag>Not graded</Tag>,
            },
          ]}
        />

        <Alert
          type={committed ? 'info' : 'warning'}
          showIcon
          title={committed ? 'Committed — locked for grading; the student can’t change it.' : 'Open — the student can still re-do this. Grading or “Commit for grading” locks it.'}
          description={released ? 'Released — the student can see this grade.' : graded ? 'Graded but held — the student cannot see it yet.' : 'Not graded yet — the student sees “awaiting grading”.'}
        />

        {flags.length > 0 && (
          <Card size="small" title="Flag answers" extra={<Tag color={correct === flags.length ? 'success' : 'default'}>{correct}/{flags.length} correct</Tag>}>
            <List
              size="small"
              split
              dataSource={flags}
              renderItem={(f, i) => (
                <List.Item key={i} extra={f.points ? <Typography.Text type="secondary">{f.points}p</Typography.Text> : null}>
                  <List.Item.Meta
                    avatar={f.correct
                      ? <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 16 }} />
                      : <CloseCircleFilled style={{ color: token.colorError, fontSize: 16 }} />}
                    title={f.question}
                    description={f.answer ? <Typography.Text code>{f.answer}</Typography.Text> : <Typography.Text type="secondary" italic>— no answer —</Typography.Text>}
                  />
                </List.Item>
              )}
            />
          </Card>
        )}

        {(submission.report || submission.reportFileName) && (
          <Card size="small" title="Report">
            <Flex vertical gap={8}>
              {submission.reportFileName && (
                <Flex align="center" gap={8}>
                  <FileTextOutlined style={{ color: token.colorPrimary }} />
                  <Typography.Text ellipsis style={{ flex: 1, minWidth: 0 }}>{submission.reportFileName}</Typography.Text>
                  <a href={`/api/submissions/${submission.id}/report`} target="_blank" rel="noreferrer">
                    <Button size="small" icon={<DownloadOutlined />}>Download</Button>
                  </a>
                </Flex>
              )}
              {submission.report && (
                <div style={{ maxHeight: 220, overflow: 'auto', padding: '10px 12px', borderRadius: token.borderRadius, background: token.colorFillQuaternary, whiteSpace: 'pre-wrap', lineHeight: 1.55, color: token.colorTextSecondary }}>
                  {submission.report}
                </div>
              )}
            </Flex>
          </Card>
        )}

        <FormLayout>
          <Form.Item
            label="Grade (0–100)"
            extra={hasAuto ? (
              <Space size={6} wrap>
                <ThunderboltOutlined style={{ color: token.colorPrimary }} />
                <span>Auto-marked from flags: <Typography.Text strong>{submission.autoBasis}</Typography.Text> → suggests <Typography.Text strong>{submission.autoGrade}/100</Typography.Text>.</span>
                {String(submission.autoGrade) !== grade && (
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setGrade(String(submission.autoGrade))}>Use</Button>
                )}
              </Space>
            ) : null}
          >
            <InputNumber
              min={0}
              max={100}
              value={grade === '' ? null : Number(grade)}
              onChange={(v) => setGrade(v == null ? '' : String(v))}
              suffix="/ 100"
              style={{ width: 180 }}
            />
          </Form.Item>
          <Form.Item label={`Feedback ${released ? '(updates what the student sees)' : '(shown to the student on release)'}`}>
            <RichTextEditor value={feedback} onChange={setFeedback} />
          </Form.Item>
        </FormLayout>
      </Flex>
    </Drawer>
  );
}

export default GradeReviewDialog;
