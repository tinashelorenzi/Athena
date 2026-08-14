'use client';
import React, { useState } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { saveAlertCase } from '@/app/actions/cases';

const VERDICTS = [
  { id: 'TRUE_POSITIVE', label: 'True Positive', tone: 'danger' },
  { id: 'FALSE_POSITIVE', label: 'False Positive', tone: 'neutral' },
  { id: 'BENIGN', label: 'Benign', tone: 'success' },
  { id: 'ESCALATED', label: 'Escalated', tone: 'warning' },
];
const IOC_TYPES = ['ip', 'domain', 'url', 'hash', 'email', 'other'];

/* Per-alert case editor: verdict, notes, IoCs, open/closed. Saves to the DB and
   reports the new state back so the alerts table updates without a reload. */
export function AlertCaseDialog({ alert, caseData, scenarioId, onClose, onSaved, onError }) {
  const [verdict, setVerdict] = useState(caseData?.verdict ?? null);
  const [status, setStatus] = useState(caseData?.status ?? 'OPEN');
  const [notes, setNotes] = useState(caseData?.notes ?? '');
  const [iocs, setIocs] = useState(() => (caseData?.iocs?.length ? caseData.iocs.map((i) => ({ type: i.type || 'other', value: i.value || '' })) : []));
  const [busy, setBusy] = useState(false);
  if (!alert) return null;

  const addIoc = () => setIocs((l) => [...l, { type: 'ip', value: '' }]);
  const setIoc = (i, patch) => setIocs((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const delIoc = (i) => setIocs((l) => l.filter((_, j) => j !== i));

  const save = async () => {
    setBusy(true);
    const payload = { verdict, status, notes, iocs: iocs.filter((i) => i.value.trim()) };
    const res = await saveAlertCase(scenarioId, alert.id, payload);
    setBusy(false);
    if (res?.error) { onError?.(res.error); return; }
    onSaved?.(alert.id, { ...payload });
    onClose();
  };

  return (
    <AC.Dialog
      open
      size="lg"
      title={`Case · ${alert.title || alert.id}`}
      description={`${alert.host || ''}${alert.rule ? ` · ${alert.rule}` : ''}`}
      icon={<Icon name="Bell" size={18} />}
      onClose={onClose}
      footer={
        <>
          <AC.Button variant="ghost" onClick={onClose}>Cancel</AC.Button>
          <AC.Button variant="primary" loading={busy} leadingIcon={<Icon name="Check" size={14} />} onClick={save}>Save case</AC.Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Verdict */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Verdict</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {VERDICTS.map((v) => {
              const on = verdict === v.id;
              return (
                <button key={v.id} type="button" onClick={() => setVerdict(on ? null : v.id)} style={{
                  padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                  border: '1px solid ' + (on ? 'transparent' : 'var(--border-default)'),
                  background: on ? `var(--${v.tone}-subtle-bg, var(--surface-raised))` : 'var(--surface-inset)',
                  color: on ? `var(--status-${v.tone === 'neutral' ? 'muted' : v.tone}, var(--text-primary))` : 'var(--text-secondary)',
                  outline: on ? '2px solid var(--accent, #7c8cff)' : 'none',
                }}>{v.label}</button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Analyst notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="What did you find? Reasoning for the verdict…" spellCheck={false}
            style={{ width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-inset)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5 }} />
        </div>

        {/* IoCs */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Indicators of compromise</span>
            <AC.Button type="button" variant="secondary" size="sm" leadingIcon={<Icon name="Plus" size={13} />} onClick={addIoc}>Add IoC</AC.Button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {iocs.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No IoCs recorded.</div>}
            {iocs.map((ioc, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 32px', gap: 8, alignItems: 'center' }}>
                <AC.Select value={ioc.type} onChange={(e) => setIoc(i, { type: e.target.value })} options={IOC_TYPES.map((t) => ({ value: t, label: t.toUpperCase() }))} />
                <AC.Input value={ioc.value} onChange={(e) => setIoc(i, { value: e.target.value })} placeholder="e.g. 185.220.101.34" mono />
                <AC.IconButton label="Remove" onClick={() => delIoc(i)}><Icon name="X" size={15} /></AC.IconButton>
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>Close this case</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Mark it handled once you've reached a verdict.</div>
          </div>
          <AC.Switch checked={status === 'CLOSED'} onChange={() => setStatus((s) => (s === 'CLOSED' ? 'OPEN' : 'CLOSED'))} />
        </div>
      </div>
    </AC.Dialog>
  );
}

export default AlertCaseDialog;
