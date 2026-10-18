'use client';
import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Flex, Form, Tag, Typography, Upload } from 'antd';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';

/* Shared antd building blocks for the instructor area (settings, cohorts,
   grading, scenario authoring). Kept here because the settings sections were
   the original home of these helpers. */

/* Page frame: 24px padding, a header row (title + secondary description on the
   left, primary actions on the right) and 16px gaps between sections. */
export function Page({ title, description, extra, back, tags, maxWidth = 1200, children }) {
  return (
    <div style={{ padding: 24, maxWidth, margin: '0 auto' }}>
      <Flex vertical gap={16}>
        <Flex align="center" justify="space-between" gap={16} wrap>
          <Flex align="center" gap={12} style={{ minWidth: 0, flex: '1 1 320px' }}>
            {back && (
              <Link href={back}><Button type="text" aria-label="Back" icon={<ArrowLeftOutlined />} /></Link>
            )}
            <div style={{ minWidth: 0 }}>
              <Flex align="center" gap={8} wrap>
                <Typography.Title level={4} style={{ margin: 0 }} ellipsis>{title}</Typography.Title>
                {tags}
              </Flex>
              {description && <Typography.Text type="secondary">{description}</Typography.Text>}
            </div>
          </Flex>
          {extra && <Flex gap={8} wrap align="center">{extra}</Flex>}
        </Flex>
        {children}
      </Flex>
    </div>
  );
}

/* Vertical antd form layout for a native <form> that posts FormData to a
   Server Action. Form.Items without `name` only provide label/hint layout, so
   field values stay in the DOM and every input keeps its `name`. */
export function FormLayout({ children }) {
  return <Form layout="vertical" component={false}>{children}</Form>;
}

/* Section title used inside Card headers: title + optional muted subtitle. */
export function SectionHeader({ icon, title, subtitle }) {
  return (
    <Flex align="center" gap={10} style={{ padding: '12px 0', minWidth: 0 }}>
      {icon}
      <div style={{ minWidth: 0 }}>
        <div>{title}</div>
        {subtitle && <Typography.Text type="secondary" style={{ fontSize: 12.5, fontWeight: 400, whiteSpace: 'normal' }}>{subtitle}</Typography.Text>}
      </div>
    </Flex>
  );
}

/* Server Action result ({ ok } | { error }) as an inline antd Alert. */
export function FormStatus({ state }) {
  if (state?.error) return <Alert type="error" showIcon title={state.error} />;
  if (state?.ok) return <Alert type="success" showIcon title={state.ok} />;
  return null;
}

/* Label/hint on the left, control (e.g. a Switch) on the right. */
export function ToggleRow({ label, hint, children }) {
  return (
    <Flex align="center" justify="space-between" gap={16} style={{ marginBottom: 20 }}>
      <div style={{ minWidth: 0 }}>
        <div>{label}</div>
        {hint && <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>{hint}</Typography.Text>}
      </div>
      {children}
    </Flex>
  );
}

/* antd Upload button that mirrors the chosen file into a hidden native
   <input type="file" name=…>, so the surrounding <form> still posts it in
   FormData exactly as before. */
export function FileField({ name, accept, label = 'Select file', size }) {
  const ref = useRef(null);
  const [list, setList] = useState([]);
  const sync = (files) => {
    if (!ref.current || typeof DataTransfer === 'undefined') return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    ref.current.files = dt.files;
  };
  return (
    <>
      <input ref={ref} type="file" name={name} accept={accept} hidden />
      <Upload
        accept={accept}
        maxCount={1}
        fileList={list}
        beforeUpload={(file) => { setList([file]); sync([file]); return false; }}
        onRemove={() => { setList([]); sync([]); }}
      >
        <Button size={size} icon={<UploadOutlined />}>{label}</Button>
      </Upload>
    </>
  );
}

/* Scenario type → antd Tag. */
export const TYPE_META = {
  DOJO: { color: 'blue', label: 'Dojo' },
  ASSESSMENT: { color: 'purple', label: 'Assessment' },
};
export function TypeTag({ type }) {
  const m = TYPE_META[type];
  return m ? <Tag color={m.color}>{m.label}</Tag> : null;
}

/* Submission lifecycle: open (student can re-do) → committed (locked, to
   grade) → held (graded, not released) → released. */
export function gradeStateOf(row) {
  if (row.status === 'GRADED') return row.released ? 'released' : 'held';
  return row.committed ? 'committed' : 'open';
}
export function GradeState({ row }) {
  const st = gradeStateOf(row);
  if (st === 'open') return <Badge status="default" text="Open" />;
  if (st === 'committed') return <Badge status="warning" text="To grade" />;
  if (st === 'held') return <Badge color="purple" text={`Held · ${row.grade ?? '—'}`} />;
  return <Badge status="success" text={`Released · ${row.grade ?? '—'}`} />;
}
