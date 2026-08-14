'use client';
import React, { useCallback, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { autoBuildScenario } from '@/app/actions/autobuild';
import { readDroppedFolder, filesFromInput, buildFolderFormData } from './scenarios/folderUpload';

/* Auto-builder: drop one folder (scenario.json manifest + brief/guide/logs/
   alerts/endpoints) and the whole scenario is created in one shot. */
export function AutoBuilder() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [status, setStatus] = useState(null); // { ok, scenarioId } | { error, scenarioId? }
  const [dragging, setDragging] = useState(false);

  const dirRef = useCallback((node) => {
    if (node) { node.setAttribute('webkitdirectory', ''); node.setAttribute('directory', ''); }
  }, []);

  const submit = (entries) => {
    if (!entries.length) { setStatus({ error: 'No files found in that drop.' }); return; }
    setStatus(null);
    start(async () => {
      const res = await autoBuildScenario(buildFolderFormData(entries));
      setStatus(res);
      if (res?.scenarioId && res?.ok) router.push(`/admin/scenarios/${res.scenarioId}`);
    });
  };

  const onDrop = async (e) => { e.preventDefault(); setDragging(false); submit(await readDroppedFolder(e.dataTransfer)); };
  const onPick = (e) => { submit(filesFromInput(e.target.files)); e.target.value = ''; };

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/admin/scenarios" style={{ textDecoration: 'none' }}><AC.IconButton label="Back"><Icon name="ArrowLeft" size={18} /></AC.IconButton></Link>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Auto-build a scenario</h2>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>Drop a folder with a <code style={{ fontFamily: 'var(--font-mono)' }}>scenario.json</code> manifest and its files.</p>
        </div>
      </div>

      <AC.Card>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 20px', borderRadius: 'var(--radius-sm)', textAlign: 'center',
            border: '1.5px dashed ' + (dragging ? 'var(--accent, #7c8cff)' : 'var(--border-default)'),
            background: dragging ? 'var(--accent-subtle-bg, rgba(124,140,255,0.08))' : 'var(--surface-inset)',
          }}
        >
          <Icon name={busy ? 'LoaderCircle' : 'PackageOpen'} size={30} style={{ color: 'var(--text-tertiary)' }} />
          <div style={{ fontSize: 14.5, color: 'var(--text-secondary)' }}>{busy ? 'Building scenario…' : 'Drag a scenario folder here'}</div>
          <label style={{ display: 'inline-block' }}>
            <input type="file" ref={dirRef} multiple onChange={onPick} style={{ display: 'none' }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5, color: 'var(--accent, #7c8cff)' }}><Icon name="FolderOpen" size={14} /> or choose a folder</span>
          </label>
        </div>

        {status?.error && (
          <div role="alert" style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--status-danger, #ef4444)' }}>
            <Icon name="TriangleAlert" size={15} style={{ flex: 'none', marginTop: 1 }} /> <span>{status.error}{status.scenarioId ? <> <Link href={`/admin/scenarios/${status.scenarioId}`}>Open the scenario →</Link></> : null}</span>
          </div>
        )}
        {status?.ok && <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--status-success, #22c55e)' }}><Icon name="CircleCheck" size={15} /> {status.ok} Redirecting…</div>}
      </AC.Card>

      <AC.Card header={<div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="FolderTree" size={16} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Folder layout</span>
        </div>
        <a href="/api/examples/autobuild-bundle" style={{ textDecoration: 'none' }}>
          <AC.Button variant="secondary" size="sm" leadingIcon={<Icon name="Download" size={14} />}>Download example</AC.Button>
        </a>
      </div>}>
        <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, overflow: 'auto' }}>{`my-scenario/
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
      evidence.zip     # optional artifact`}</pre>
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-tertiary)' }}>Full spec + example: <code style={{ fontFamily: 'var(--font-mono)' }}>docs/autobuild.md</code>. Works for both Dojo and Assessment scenarios.</div>
      </AC.Card>
    </div>
  );
}

export default AutoBuilder;
