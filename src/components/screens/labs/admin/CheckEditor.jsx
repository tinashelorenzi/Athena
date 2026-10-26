'use client';
import React, { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, App, Button, Card, Col, Collapse, Empty, Flex, Progress, Row, Select, Space, Tabs, Tag, Typography, Upload, theme,
} from 'antd';
import { CaretRightOutlined, CloudUploadOutlined, DownloadOutlined, FileSearchOutlined, UndoOutlined } from '@ant-design/icons';
import { publishLabEdit, runLabEditor } from '@/app/actions/lab-admin';
import { Page } from '../../settings/parts';
import { CheckLine, ItemValue } from './LabSessions';

const { Text, Paragraph } = Typography;

const DRAFT_KEY = (labId) => `athena.labEditor.draft.${labId}`;
const readDraft = (labId) => { try { return localStorage.getItem(DRAFT_KEY(labId)); } catch { return null; } };
const writeDraft = (labId, v) => { try { localStorage.setItem(DRAFT_KEY(labId), v); } catch { /* storage unavailable */ } };
const subscribeNothing = () => () => {};
const clearDraft = (labId) => { try { localStorage.removeItem(DRAFT_KEY(labId)); } catch { /* storage unavailable */ } };

/* Edit lab.yaml next to real evidence: every assertion's result, evaluation
   notes and every parser's output, live. Publishing creates the next version
   after the same reference gate an upload goes through. */
export function CheckEditor({ scenarioId, labId, slug, title, initial }) {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();
  const editorRef = useRef(null);
  const [yaml, setYaml] = useState(initial.source);
  // An unsaved draft from an earlier visit (read on the client only).
  const savedDraft = useSyncExternalStore(subscribeNothing, () => readDraft(labId), () => null);
  const [touched, setTouched] = useState(false);
  const [source, setSource] = useState(initial.references.good ? 'ref:good' : initial.runs[0] ? `run:${initial.runs[0].id}` : null);
  const [uploaded, setUploaded] = useState(null); // { name, evidence }
  const [out, setOut] = useState(null);
  const [running, startRun] = useTransition();
  const [publishing, startPublish] = useTransition();
  const dirty = yaml !== initial.source;

  // Keep edits across reloads until they're published or reverted.
  useEffect(() => {
    if (!touched) return;
    if (dirty) writeDraft(labId, yaml); else clearDraft(labId);
  }, [yaml, dirty, touched, labId]);
  const edit = (v) => { setTouched(true); setYaml(v); };
  const showRestore = !touched && savedDraft && savedDraft !== initial.source;

  const sourceArg = () => {
    if (source === 'ref:good') return { kind: 'reference', which: 'good' };
    if (source === 'ref:broken') return { kind: 'reference', which: 'broken' };
    if (source === 'upload') return uploaded ? { kind: 'upload', evidence: uploaded.evidence } : null;
    if (source?.startsWith('run:')) return { kind: 'run', runId: source.slice(4) };
    return null;
  };

  const run = () => {
    const src = sourceArg();
    if (!src) { message.warning('Choose evidence to run against.'); return; }
    startRun(async () => {
      const res = await runLabEditor(labId, yaml, src);
      if (res?.error) message.error(res.error);
      else setOut(res);
    });
  };

  const publish = () => modal.confirm({
    title: `Publish as version ${initial.version + 1}?`,
    content: 'The edited lab.yaml is checked against the stored reference evidence first. Running sessions keep the version they started on; new sessions use the new one.',
    okText: 'Check and publish',
    onOk: () => new Promise((resolve) => startPublish(async () => {
      const res = await publishLabEdit(labId, yaml);
      resolve();
      if (res?.error) { message.error(res.error); return; }
      if (!res.ok) {
        modal.error({ title: 'Not published', width: 640, content: <Flex vertical gap={4}>{res.errors.map((e, i) => <Text key={i}><Text code>{e.file ?? 'lab.yaml'}{e.line ? `:${e.line}` : ''}</Text> {e.message}</Text>)}</Flex> });
        return;
      }
      clearDraft(labId);
      message.success(res.draft ? `Published version ${res.version} as a draft (no good reference yet)` : `Published version ${res.version}`);
      router.push(`/admin/scenarios/${scenarioId}`);
    })),
  });

  const download = () => {
    const url = URL.createObjectURL(new Blob([yaml], { type: 'text/yaml' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'lab.yaml' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const goToLine = (line) => {
    const el = editorRef.current;
    if (!el || !line) return;
    const offset = yaml.split('\n').slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
    el.focus();
    el.setSelectionRange(offset, offset + (yaml.split('\n')[line - 1]?.length ?? 0));
    el.scrollTop = Math.max(0, (line - 5) * 18.5);
  };

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: s, selectionEnd: t } = el;
      const next = `${yaml.slice(0, s)}  ${yaml.slice(t)}`;
      edit(next);
      requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
    }
  };

  const options = [
    { label: 'Reference evidence', options: [
      { value: 'ref:good', label: 'Good reference (answer key)', disabled: !initial.references.good },
      { value: 'ref:broken', label: 'Broken reference', disabled: !initial.references.broken },
    ] },
    { label: 'Student check runs', options: initial.runs.length ? initial.runs.map((r) => ({ value: `run:${r.id}`, label: `${r.label}${r.score != null ? ` · ${r.score}/${r.maxScore}` : ''}` })) : [{ value: 'none', label: 'No graded runs yet', disabled: true }] },
    { label: 'File', options: [{ value: 'upload', label: uploaded ? `Uploaded: ${uploaded.name}` : 'An evidence file…' }] },
  ];

  const lineCount = yaml.split('\n').length;
  return (
    <Page
      back={`/admin/scenarios/${scenarioId}`}
      title="Check editor"
      description={<>{title} · <Text code>{slug}</Text> · editing version {initial.version}{dirty ? <Tag color="gold" style={{ marginLeft: 8 }}>unsaved</Tag> : null}</>}
      maxWidth={1500}
      extra={
        <>
          {showRestore && <Button onClick={() => edit(savedDraft)}>Restore unsaved edits</Button>}
          {dirty && <Button icon={<UndoOutlined />} onClick={() => edit(initial.source)}>Revert</Button>}
          <Button icon={<DownloadOutlined />} onClick={download}>Download lab.yaml</Button>
          <Button type="primary" icon={<CloudUploadOutlined />} disabled={!dirty} loading={publishing} onClick={publish}>Publish as v{initial.version + 1}</Button>
        </>
      }
    >
      {!initial.source && (
        <Alert type="warning" showIcon title="This version was uploaded before lab.yaml sources were kept" description="Paste the lab.yaml from the lab folder to start, or re-upload the folder." />
      )}
      <Row gutter={16}>
        <Col xs={24} xl={11}>
          <Card size="small" title="lab.yaml" extra={<Text type="secondary" style={{ fontSize: 12 }}>{lineCount} lines · Ctrl+Enter runs</Text>} styles={{ body: { padding: 0 } }}>
            <textarea
              ref={editorRef}
              value={yaml}
              onChange={(e) => edit(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              aria-label="lab.yaml"
              style={{
                width: '100%', height: '72vh', resize: 'vertical', border: 0, outline: 'none', padding: 12,
                fontFamily: token.fontFamilyCode, fontSize: 12.5, lineHeight: '18.5px', background: token.colorFillQuaternary, color: token.colorText,
                tabSize: 2, whiteSpace: 'pre', overflow: 'auto',
              }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={13}>
          <Flex vertical gap={12}>
            <Card size="small">
              <Flex gap={8} wrap align="center">
                <Select value={source} onChange={setSource} options={options} style={{ minWidth: 360, flex: 1 }} placeholder="Evidence to run against" />
                {source === 'upload' && (
                  <Upload
                    accept=".json,application/json"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      file.text().then((t) => {
                        try { setUploaded({ name: file.name, evidence: JSON.parse(t) }); } catch { message.error('That file is not valid JSON.'); }
                      });
                      return Upload.LIST_IGNORE;
                    }}
                  >
                    <Button icon={<FileSearchOutlined />}>Choose file</Button>
                  </Upload>
                )}
                <Button type="primary" icon={<CaretRightOutlined />} loading={running} onClick={run}>Run</Button>
              </Flex>
            </Card>
            {!out ? (
              <Card><Empty description="Run the checks to see results, evaluation notes and parser output here." /></Card>
            ) : (
              <EditorResults out={out} onLine={goToLine} />
            )}
          </Flex>
        </Col>
      </Row>
    </Page>
  );
}

function EditorResults({ out, onLine }) {
  if (out.errors.length) {
    return (
      <Card size="small" title={<Text type="danger">{out.errors.length} problem{out.errors.length === 1 ? '' : 's'} in lab.yaml</Text>}>
        <Flex vertical gap={6}>
          {out.errors.map((e, i) => (
            <Flex key={i} gap={8} align="baseline">
              <Button size="small" type="link" style={{ padding: 0 }} onClick={() => onLine(e.line)} disabled={!e.line}>{e.line ? `line ${e.line}` : '—'}</Button>
              <Text code style={{ fontSize: 12 }}>{e.path || 'lab.yaml'}</Text>
              <Text>{e.message}</Text>
            </Flex>
          ))}
        </Flex>
      </Card>
    );
  }
  if (out.problem) return <Alert type="warning" showIcon title={out.problem} />;
  const r = out.result;
  const pct = r.maxScore ? Math.round((r.score / r.maxScore) * 100) : 0;
  return (
    <Flex vertical gap={12}>
      {out.warnings.length > 0 && (
        <Alert type="info" showIcon title={`${out.warnings.length} warning${out.warnings.length === 1 ? '' : 's'}`} description={out.warnings.map((w, i) => <div key={i}>{w.line ? `line ${w.line}: ` : ''}{w.message}</div>)} />
      )}
      <Card
        size="small"
        title="Checks"
        extra={<Space><Progress type="circle" size={30} percent={pct} status={pct === 100 ? 'success' : 'normal'} /><Text strong>{r.score}/{r.maxScore}</Text>{r.flags.map((f) => <Tag key={f} color="red">{f}</Tag>)}</Space>}
      >
        {r.checks.map((c) => <CheckLine key={c.id} c={c} />)}
        <Text type="secondary" style={{ fontSize: 11 }}>values: {Object.entries(out.params).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'} · grader {r.graderRev}</Text>
      </Card>
      <Card size="small" styles={{ body: { paddingTop: 0 } }}>
        <Tabs
          items={[
            {
              key: 'parsed', label: `Parsed (${Object.keys(r.parsed).length})`,
              children: Object.keys(r.parsed).length ? (
                <Collapse
                  size="small"
                  items={Object.entries(r.parsed).map(([name, value]) => {
                    const text = JSON.stringify(value, null, 1);
                    return {
                      key: name,
                      label: <Flex gap={8}><Text code>{name}</Text><Text type="secondary" style={{ fontSize: 12 }}>{Array.isArray(value) ? `${value.length} records` : typeof value}</Text></Flex>,
                      children: <pre style={{ margin: 0, maxHeight: 420, overflow: 'auto', fontSize: 11.5 }}>{text.length > 200_000 ? `${text.slice(0, 200_000)}\n… (truncated)` : text}</pre>,
                    };
                  })}
                />
              ) : <Paragraph type="secondary">No parse steps, or their inputs weren&apos;t collected.</Paragraph>,
            },
            {
              key: 'evidence', label: 'Evidence',
              children: (
                <Collapse
                  size="small"
                  items={Object.entries(out.evidence?.roles ?? {}).flatMap(([role, ev]) => Object.entries(ev.items ?? {}).map(([name, item]) => ({
                    key: `${role}.${name}`,
                    label: <Flex gap={8}><Tag style={{ margin: 0 }}>{role}</Tag><Text code>{name}</Text>{!item.ok && <Text type="danger">{item.error}</Text>}</Flex>,
                    children: <ItemValue item={item} />,
                  })))}
                />
              ),
            },
          ]}
        />
      </Card>
    </Flex>
  );
}

export default CheckEditor;
