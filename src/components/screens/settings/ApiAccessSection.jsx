'use client';
import React, { useState, useTransition } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { createApiKey, revokeApiKey } from '@/app/actions/apikeys';
import { SectionHeader } from './parts';

/* API key management. Keys are shown once on creation; only their hash is
   stored. They authenticate requests to /api/v1/* (see GET /api/v1/ping). */
export function ApiAccessSection({ apiKeys }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [creating, startCreate] = useTransition();
  const [revealed, setRevealed] = useState(null); // { name, key }
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const openCreate = () => { setCreateError(null); setCreateOpen(true); };

  const onCreateSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startCreate(async () => {
      const res = await createApiKey({}, formData);
      if (res?.error) { setCreateError(res.error); return; }
      form.reset();
      setCreateError(null);
      setCreateOpen(false);
      setRevealed(res.created);
    });
  };

  const onRevoke = async (k) => {
    setError(null);
    setBusyId(k.id);
    const res = await revokeApiKey(k.id);
    setBusyId(null);
    if (res?.error) setError(res.error);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <AC.Toast tone="danger" title="Something went wrong" message={error} onClose={() => setError(null)} />}

      <AC.Card
        header={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
            <div style={{ flex: 1 }}><SectionHeader icon="KeySquare" title="API keys" subtitle="Let other applications integrate with Athena." /></div>
            <AC.Button variant="primary" size="sm" leadingIcon={<Icon name="Plus" size={14} />} onClick={openCreate}>Generate key</AC.Button>
          </div>
        }
        padded={false}
      >
        {apiKeys.length === 0 ? (
          <div style={{ padding: 8 }}>
            <AC.EmptyState icon={<Icon name="KeySquare" size={24} />} title="No API keys" description="Generate a key to let an external app call the Athena API." actions={<AC.Button variant="primary" size="sm" onClick={openCreate}>Generate key</AC.Button>} />
          </div>
        ) : (
          <AC.Table
            rowKey="id"
            hover={false}
            columns={[
              { key: 'name', header: 'Name', primary: true },
              { key: 'prefix', header: 'Key', mono: true, render: (v) => `${v}…` },
              { key: 'created', header: 'Created', mono: true, width: '120px' },
              { key: 'lastUsed', header: 'Last used', mono: true, width: '130px' },
              {
                key: 'id', header: '', width: '110px', align: 'right',
                render: (_v, row) => (
                  <AC.Button variant="outline-danger" size="sm" loading={busyId === row.id} leadingIcon={<Icon name="Trash2" size={14} />} onClick={() => onRevoke(row)}>Revoke</AC.Button>
                ),
              },
            ]}
            rows={apiKeys}
          />
        )}
      </AC.Card>

      <AC.Card header={<SectionHeader icon="Terminal" title="Using a key" subtitle="Send it as a Bearer token." />}>
        <pre style={{ margin: 0, padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-inset)', border: '1px solid var(--border-default)', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)', overflow: 'auto' }}>
{`curl -H "Authorization: Bearer ath_..." \\
  https://<your-athena-host>/api/v1/ping`}
        </pre>
      </AC.Card>

      {/* Generate dialog */}
      <AC.Dialog
        open={createOpen}
        title="Generate API key"
        description="Name the key so you know which integration it belongs to."
        icon={<Icon name="KeySquare" size={18} />}
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={onCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AC.Input label="Key name" name="name" placeholder="e.g. Grafana integration" required leadingIcon={<Icon name="Tag" size={16} />} />
          {createError && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--status-danger, #ef4444)' }}>
              <Icon name="TriangleAlert" size={15} /> {createError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <AC.Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</AC.Button>
            <AC.Button type="submit" variant="primary" loading={creating} leadingIcon={<Icon name="Plus" size={14} />}>Generate</AC.Button>
          </div>
        </form>
      </AC.Dialog>

      {/* Reveal-once dialog */}
      <RevealKeyDialog key={revealed ? revealed.key : 'none'} revealed={revealed} onClose={() => setRevealed(null)} />
    </div>
  );
}

function RevealKeyDialog({ revealed, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!revealed) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(revealed.key); setCopied(true); } catch { /* blocked */ }
  };

  return (
    <AC.Dialog
      open
      title="API key created"
      description="Copy this key now — it is shown only once and cannot be recovered."
      icon={<Icon name="KeyRound" size={18} />}
      onClose={onClose}
      footer={
        <>
          <AC.Button variant="secondary" leadingIcon={<Icon name={copied ? 'Check' : 'Copy'} size={14} />} onClick={copy}>{copied ? 'Copied' : 'Copy key'}</AC.Button>
          <AC.Button variant="primary" onClick={onClose}>Done</AC.Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-inset)', border: '1px solid var(--border-default)' }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{revealed.name}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{revealed.key}</div>
      </div>
    </AC.Dialog>
  );
}

export default ApiAccessSection;
