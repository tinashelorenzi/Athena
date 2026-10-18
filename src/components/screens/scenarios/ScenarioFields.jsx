'use client';
import React, { useState } from 'react';
import { Button, Card, Col, Empty, Flex, Input, Row, Select, Switch } from 'antd';
import {
  FileTextOutlined, ReadOutlined, AimOutlined, FlagOutlined, FileDoneOutlined, DatabaseOutlined,
  PlusOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { Field, Textarea } from './primitives';
import { JsonField } from './JsonField';
import { FormLayout, SectionHeader, ToggleRow } from '../settings/parts';

// Re-exported so existing importers (e.g. ScenarioEditor) keep working.
export { Field, Textarea } from './primitives';

/* Shared authoring fields for a scenario (create + edit). Objectives and flags
   are dynamic lists serialized into hidden JSON inputs; the server normalizes
   them. antd Select/Switch aren't native inputs, so their state is mirrored
   into hidden inputs with the names the server actions read. When
   mode="create" the raw logs/alerts JSON sections are shown. */
export function ScenarioFields({ mode = 'create', initial = {} }) {
  const [type, setType] = useState(initial.type || 'DOJO');
  const [exposure, setExposure] = useState(initial.exposure || 'ROLLOUT');
  const [hidden, setHidden] = useState(Boolean(initial.hidden));
  const [realtime, setRealtime] = useState(Boolean(initial.realtime));
  const [reportRequired, setReportRequired] = useState(Boolean(initial.reportRequired));
  const [objectives, setObjectives] = useState(
    (initial.objectives || []).map((o) => ({ text: o.text })),
  );
  const [flags, setFlags] = useState(
    (initial.flags || []).map((f) => ({ question: f.question, answer: f.answer, points: f.points ?? 0 })),
  );

  const addObjective = () => setObjectives((l) => [...l, { text: '' }]);
  const setObjective = (i, text) => setObjectives((l) => l.map((o, j) => (j === i ? { text } : o)));
  const delObjective = (i) => setObjectives((l) => l.filter((_, j) => j !== i));

  const addFlag = () => setFlags((l) => [...l, { question: '', answer: '', points: 0 }]);
  const setFlag = (i, patch) => setFlags((l) => l.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const delFlag = (i) => setFlags((l) => l.filter((_, j) => j !== i));

  return (
    <FormLayout>
      <Flex vertical gap={16}>
        {/* Basics */}
        <Card title={<SectionHeader icon={<FileTextOutlined />} title="Basics" />}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Field label="Type">
                <Select value={type} onChange={setType}
                  options={[{ value: 'DOJO', label: 'Dojo (teaching)' }, { value: 'ASSESSMENT', label: 'Assessment (graded)' }]} />
              </Field>
            </Col>
            <Col xs={24} md={12}>
              <Field label="Exposure">
                <Select value={exposure} onChange={setExposure}
                  options={[{ value: 'ROLLOUT', label: 'Rollout (hidden from students)' }, { value: 'PUBLIC', label: 'Public (can show)' }]} />
              </Field>
            </Col>
          </Row>
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="exposure" value={exposure} />
          <Field label="Title" required>
            <Input name="title" defaultValue={initial.title || ''} required placeholder="e.g. Ransomware in Finance" />
          </Field>
          <Field label="Description">
            <Textarea name="description" rows={2} defaultValue={initial.description || ''} placeholder="One or two sentences summarizing the scenario." />
          </Field>
          {type === 'DOJO' && (
            <ToggleRow label="Hidden" hint="Reachable only by direct link — not listed for students.">
              <Switch checked={hidden} onChange={setHidden} />
            </ToggleRow>
          )}
          <ToggleRow label="Real-time simulation" hint="Feed runs continuously and can't be paused (like a live SOC shift). Off = students can pause & resume.">
            <Switch checked={realtime} onChange={setRealtime} />
          </ToggleRow>
          <input type="hidden" name="hidden" value={type === 'DOJO' && hidden ? 'on' : ''} />
          <input type="hidden" name="realtime" value={realtime ? 'on' : ''} />
        </Card>

        {/* Brief */}
        <Card title={<SectionHeader icon={<ReadOutlined />} title="Brief" subtitle="Markdown shown to students as the scenario briefing." />}>
          <Textarea name="brief" mono rows={8} defaultValue={initial.brief || ''} placeholder={'## Situation\nA finance workstation is showing signs of...'} />
        </Card>

        {/* Objectives */}
        <Card
          title={<SectionHeader icon={<AimOutlined />} title="Objectives" subtitle="Guidance points shown to students." />}
          extra={<Button size="small" icon={<PlusOutlined />} onClick={addObjective}>Add</Button>}
        >
          {objectives.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No objectives yet." />
          ) : (
            <Flex vertical gap={8}>
              {objectives.map((o, i) => (
                <Flex key={i} gap={8} align="center">
                  <Input value={o.text} onChange={(e) => setObjective(i, e.target.value)} placeholder={`Objective ${i + 1}`} />
                  <Button type="text" aria-label="Remove" icon={<DeleteOutlined />} onClick={() => delObjective(i)} />
                </Flex>
              ))}
            </Flex>
          )}
          <input type="hidden" name="objectivesJson" value={JSON.stringify(objectives)} />
        </Card>

        {/* Flags */}
        <Card
          title={<SectionHeader icon={<FlagOutlined />} title="Flags" subtitle="Question / answer pairs for labs. Answers are kept server-side." />}
          extra={<Button size="small" icon={<PlusOutlined />} onClick={addFlag}>Add</Button>}
        >
          {flags.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No flags yet." />
          ) : (
            <Flex vertical gap={8}>
              {flags.map((f, i) => (
                <Row key={i} gutter={8} align="middle" wrap={false}>
                  <Col flex="1 1 0"><Input value={f.question} onChange={(e) => setFlag(i, { question: e.target.value })} placeholder="Question" /></Col>
                  <Col flex="1 1 0"><Input value={f.answer} onChange={(e) => setFlag(i, { answer: e.target.value })} placeholder="Answer" /></Col>
                  <Col flex="88px"><Input type="number" value={f.points} onChange={(e) => setFlag(i, { points: e.target.value })} placeholder="Pts" suffix="pts" /></Col>
                  <Col flex="none"><Button type="text" aria-label="Remove" icon={<DeleteOutlined />} onClick={() => delFlag(i)} /></Col>
                </Row>
              ))}
            </Flex>
          )}
          <input type="hidden" name="flagsJson" value={JSON.stringify(flags)} />
        </Card>

        {/* Report */}
        <Card title={<SectionHeader icon={<FileDoneOutlined />} title="Report" subtitle="Optionally require students to submit a written report." />}>
          <ToggleRow label="Require a report submission">
            <Switch checked={reportRequired} onChange={setReportRequired} />
          </ToggleRow>
          <input type="hidden" name="reportRequired" value={reportRequired ? 'on' : ''} />
          {reportRequired && (
            <Field label="Report prompt">
              <Textarea name="reportPrompt" rows={3} defaultValue={initial.reportPrompt || ''} placeholder="What should the student's report cover?" />
            </Field>
          )}
        </Card>

        {/* Raw data (create only) */}
        {mode === 'create' && (
          <Card title={<SectionHeader icon={<DatabaseOutlined />} title="SOC data (optional)" subtitle="Raw JSON bundles the student investigates. See docs/scenario-schemas.md." />}>
            <JsonField label="Logs bundle" name="logs" example="logs" placeholder='{ "version": 1, "entries": [] }' hint="Paste JSON, upload a .json file, or click Show example." />
            <JsonField label="Alerts bundle" name="alerts" example="alerts" placeholder='{ "version": 1, "alerts": [] }' hint="Each alert needs a `seek` (seconds from start)." />
          </Card>
        )}
      </Flex>
    </FormLayout>
  );
}

export default ScenarioFields;
