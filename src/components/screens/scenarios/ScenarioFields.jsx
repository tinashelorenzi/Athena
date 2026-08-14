'use client';
import React, { useState } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { Field, Textarea } from './primitives';
import { JsonField } from './JsonField';

// Re-exported so existing importers (e.g. ScenarioEditor) keep working.
export { Field, Textarea } from './primitives';

/* Shared authoring fields for a scenario (create + edit). Objectives and flags
   are dynamic lists serialized into hidden JSON inputs; the server normalizes
   them. When mode="create" the raw logs/alerts JSON sections are shown. */
export function ScenarioFields({ mode = 'create', initial = {} }) {
  const [type, setType] = useState(initial.type || 'DOJO');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Basics */}
      <AC.Card header={<Header icon="FileText" title="Basics" />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <AC.Select label="Type" name="type" value={type} onChange={(e) => setType(e.target.value)}
              options={[{ value: 'DOJO', label: 'Dojo (teaching)' }, { value: 'ASSESSMENT', label: 'Assessment (graded)' }]} />
            <AC.Select label="Exposure" name="exposure" defaultValue={initial.exposure || 'ROLLOUT'}
              options={[{ value: 'ROLLOUT', label: 'Rollout (hidden from students)' }, { value: 'PUBLIC', label: 'Public (can show)' }]} />
          </div>
          <AC.Input label="Title" name="title" defaultValue={initial.title || ''} required placeholder="e.g. Ransomware in Finance" />
          <Field label="Description">
            <Textarea name="description" rows={2} defaultValue={initial.description || ''} placeholder="One or two sentences summarizing the scenario." />
          </Field>
          {type === 'DOJO' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>Hidden</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Reachable only by direct link — not listed for students.</div>
              </div>
              <AC.Switch checked={hidden} onChange={() => setHidden((v) => !v)} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '4px 0' }}>
            <div>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>Real-time simulation</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Feed runs continuously and can't be paused (like a live SOC shift). Off = students can pause &amp; resume.</div>
            </div>
            <AC.Switch checked={realtime} onChange={() => setRealtime((v) => !v)} />
          </div>
          <input type="hidden" name="hidden" value={type === 'DOJO' && hidden ? 'on' : ''} />
          <input type="hidden" name="realtime" value={realtime ? 'on' : ''} />
        </div>
      </AC.Card>

      {/* Brief */}
      <AC.Card header={<Header icon="BookOpen" title="Brief" subtitle="Markdown shown to students as the scenario briefing." />}>
        <Textarea name="brief" mono rows={8} defaultValue={initial.brief || ''} placeholder={'## Situation\nA finance workstation is showing signs of...'} />
      </AC.Card>

      {/* Objectives */}
      <AC.Card header={<Header icon="Target" title="Objectives" subtitle="Guidance points shown to students." action={<AC.Button type="button" variant="secondary" size="sm" leadingIcon={<Icon name="Plus" size={13} />} onClick={addObjective}>Add</AC.Button>} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {objectives.length === 0 && <Empty text="No objectives yet." />}
          {objectives.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <AC.Input value={o.text} onChange={(e) => setObjective(i, e.target.value)} placeholder={`Objective ${i + 1}`} />
              <AC.IconButton label="Remove" onClick={() => delObjective(i)}><Icon name="X" size={15} /></AC.IconButton>
            </div>
          ))}
        </div>
        <input type="hidden" name="objectivesJson" value={JSON.stringify(objectives)} />
      </AC.Card>

      {/* Flags */}
      <AC.Card header={<Header icon="Flag" title="Flags" subtitle="Question / answer pairs for labs. Answers are kept server-side." action={<AC.Button type="button" variant="secondary" size="sm" leadingIcon={<Icon name="Plus" size={13} />} onClick={addFlag}>Add</AC.Button>} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {flags.length === 0 && <Empty text="No flags yet." />}
          {flags.map((f, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 76px 32px', gap: 8, alignItems: 'center' }}>
              <AC.Input value={f.question} onChange={(e) => setFlag(i, { question: e.target.value })} placeholder="Question" />
              <AC.Input value={f.answer} onChange={(e) => setFlag(i, { answer: e.target.value })} placeholder="Answer" mono />
              <AC.Input type="number" value={f.points} onChange={(e) => setFlag(i, { points: e.target.value })} placeholder="Pts" />
              <AC.IconButton label="Remove" onClick={() => delFlag(i)}><Icon name="X" size={15} /></AC.IconButton>
            </div>
          ))}
        </div>
        <input type="hidden" name="flagsJson" value={JSON.stringify(flags)} />
      </AC.Card>

      {/* Report */}
      <AC.Card header={<Header icon="FileCheck" title="Report" subtitle="Optionally require students to submit a written report." />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>Require a report submission</span>
            <AC.Switch checked={reportRequired} onChange={() => setReportRequired((v) => !v)} />
          </div>
          <input type="hidden" name="reportRequired" value={reportRequired ? 'on' : ''} />
          {reportRequired && (
            <Field label="Report prompt">
              <Textarea name="reportPrompt" rows={3} defaultValue={initial.reportPrompt || ''} placeholder="What should the student's report cover?" />
            </Field>
          )}
        </div>
      </AC.Card>

      {/* Raw data (create only) */}
      {mode === 'create' && (
        <AC.Card header={<Header icon="Database" title="SOC data (optional)" subtitle="Raw JSON bundles the student investigates. See docs/scenario-schemas.md." />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <JsonField label="Logs bundle" name="logs" example="logs" placeholder='{ "version": 1, "entries": [] }' hint="Paste JSON, upload a .json file, or click Show example." />
            <JsonField label="Alerts bundle" name="alerts" example="alerts" placeholder='{ "version": 1, "alerts": [] }' hint="Each alert needs a `seek` (seconds from start)." />
          </div>
        </AC.Card>
      )}
    </div>
  );
}

function Header({ icon, title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
      <Icon name={icon} size={16} style={{ color: 'var(--text-secondary)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', padding: '4px 0' }}>{text}</div>;
}

export default ScenarioFields;
