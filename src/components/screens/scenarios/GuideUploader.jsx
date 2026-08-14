'use client';
import React, { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { uploadGuide, removeGuide } from '@/app/actions/guide';
import { readDroppedFolder, filesFromInput, buildFolderFormData } from './folderUpload';
import { GuidePreview } from './GuidePreview';

/* Drag-and-drop (or pick) a folder containing main.md + image assets. main.md is
   parsed for ```prompt blocks; images are uploaded to storage and served to
   students via /api/scenarios/[id]/guide/. */
export function GuideUploader({ scenarioId, guide, preview }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [status, setStatus] = useState(null); // { ok } | { error }
  const [dragging, setDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const dirRef = useCallback((node) => {
    if (node) { node.setAttribute('webkitdirectory', ''); node.setAttribute('directory', ''); }
  }, []);

  const submit = (fileEntries) => {
    if (!fileEntries.length) { setStatus({ error: 'No files found in that drop.' }); return; }
    setStatus(null);
    start(async () => {
      const res = await uploadGuide(scenarioId, buildFolderFormData(fileEntries));
      setStatus(res);
      if (res?.ok) router.refresh();
    });
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    submit(await readDroppedFolder(e.dataTransfer));
  };

  const onPick = (e) => {
    submit(filesFromInput(e.target.files));
    e.target.value = '';
  };

  const onRemove = () => {
    setStatus(null);
    start(async () => { const res = await removeGuide(scenarioId); if (!res?.error) router.refresh(); else setStatus(res); });
  };

  return (
    <AC.Card header={<div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="GraduationCap" size={16} style={{ color: 'var(--text-secondary)' }} />
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>Learning guide</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Drop a folder with <code style={{ fontFamily: 'var(--font-mono)' }}>main.md</code> + images. Use ```prompt blocks for CTF questions.</div>
        </div>
      </div>
      {guide?.has && preview && <AC.Button variant="ghost" size="sm" leadingIcon={<Icon name={showPreview ? 'EyeOff' : 'Eye'} size={14} />} onClick={() => setShowPreview((v) => !v)}>{showPreview ? 'Hide preview' : 'Preview'}</AC.Button>}
      {guide?.has && <AC.Button variant="ghost" size="sm" loading={busy} leadingIcon={<Icon name="Trash2" size={14} />} onClick={onRemove}>Remove</AC.Button>}
    </div>}>
      {guide?.has && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <AC.Badge tone="success" dot square>Guide uploaded</AC.Badge>
          <AC.Badge tone="neutral" square>{guide.promptCount} prompt{guide.promptCount === 1 ? '' : 's'}</AC.Badge>
          <AC.Badge tone="neutral" square>{guide.assetCount} asset{guide.assetCount === 1 ? '' : 's'}</AC.Badge>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '26px 16px', borderRadius: 'var(--radius-sm)', textAlign: 'center',
          border: '1.5px dashed ' + (dragging ? 'var(--accent, #7c8cff)' : 'var(--border-default)'),
          background: dragging ? 'var(--accent-subtle-bg, rgba(124,140,255,0.08))' : 'var(--surface-inset)',
        }}
      >
        <Icon name="FolderUp" size={26} style={{ color: 'var(--text-tertiary)' }} />
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{busy ? 'Uploading…' : guide?.has ? 'Drop a folder to replace the guide' : 'Drag a guide folder here'}</div>
        <label style={{ display: 'inline-block' }}>
          <input type="file" ref={dirRef} multiple onChange={onPick} style={{ display: 'none' }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5, color: 'var(--accent, #7c8cff)' }}><Icon name="FolderOpen" size={14} /> or choose a folder</span>
        </label>
      </div>

      {status?.error && <div role="alert" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--status-danger, #ef4444)' }}><Icon name="TriangleAlert" size={15} /> {status.error}</div>}
      {status?.ok && <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--status-success, #22c55e)' }}><Icon name="CircleCheck" size={15} /> {status.ok}</div>}

      {showPreview && preview && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>Student view · answers revealed</div>
          <GuidePreview scenarioId={scenarioId} markdown={preview.markdown} prompts={preview.prompts} />
        </div>
      )}
    </AC.Card>
  );
}

export default GuideUploader;
