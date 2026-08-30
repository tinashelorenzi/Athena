'use client';
import React, { useCallback, useEffect, useState } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';

/* Lightweight first-run product tour: spotlights a sequence of elements (found
   by `data-tour` selector) with an explaining popover. Auto-starts once per
   `storageKey` (localStorage), and re-runs on the `athena:start-tour` window
   event (fired by startTour(), e.g. a navbar "Walkthrough" button). Steps whose
   target isn't in the DOM are skipped, so conditional UI is handled for free. */
const TOUR_EVENT = 'athena:start-tour';
const POP_W = 340;
const POP_H = 190;
const M = 12;

/** Fire from anywhere (e.g. a navbar button) to (re)start the current page's tour. */
export function startTour() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(TOUR_EVENT));
}

export function Tour({ steps, storageKey }) {
  const [run, setRun] = useState(null); // resolved steps array while active, else null
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);

  const start = useCallback(() => {
    const resolved = (steps || []).filter((s) => !s.selector || document.querySelector(s.selector));
    if (resolved.length === 0) return;
    setIdx(0);
    setRect(null);
    setRun(resolved);
  }, [steps]);

  const finish = useCallback(() => {
    setRun(null);
    setRect(null);
    try { localStorage.setItem(storageKey, '1'); } catch { /* private mode */ }
  }, [storageKey]);

  // Auto-start on first visit + listen for a manual (re)start.
  useEffect(() => {
    let seen = true;
    try { seen = localStorage.getItem(storageKey) === '1'; } catch { seen = false; }
    let t;
    if (!seen) t = setTimeout(start, 650); // let the page settle first
    const onEvt = () => start();
    window.addEventListener(TOUR_EVENT, onEvt);
    return () => { clearTimeout(t); window.removeEventListener(TOUR_EVENT, onEvt); };
  }, [start, storageKey]);

  const step = run ? run[idx] : null;

  // Track the target's position (through scroll / resize / step change).
  useEffect(() => {
    if (!step) return;
    const el = step.selector ? document.querySelector(step.selector) : null;
    if (!el) { setRect(null); return; }
    try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch { /* older browsers */ }
    const measure = () => setRect(el.getBoundingClientRect());
    const t = setTimeout(measure, 280);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [step, idx]);

  const next = useCallback(() => {
    if (!run) return;
    if (idx < run.length - 1) setIdx(idx + 1);
    else finish();
  }, [run, idx, finish]);
  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!run) return;
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, finish, next, prev]);

  if (!run || !step) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  let top;
  let left;
  if (!rect) {
    top = vh / 2 - POP_H / 2;
    left = vw / 2 - POP_W / 2;
  } else {
    const below = rect.bottom + M + POP_H < vh;
    top = below ? rect.bottom + M : Math.max(M, rect.top - POP_H - M);
    left = Math.min(Math.max(M, rect.left + rect.width / 2 - POP_W / 2), vw - POP_W - M);
  }

  const last = idx === run.length - 1;

  return (
    <>
      {/* Click blocker; the spotlight box-shadow provides the dim, so this stays
          transparent when a target is highlighted (dim it for centered steps). */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: rect ? 'transparent' : 'rgba(10,15,28,0.55)' }} />

      {rect && (
        <div style={{
          position: 'fixed', top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12,
          borderRadius: 12, boxShadow: '0 0 0 9999px rgba(10,15,28,0.55)', border: '2px solid var(--accent)',
          pointerEvents: 'none', zIndex: 1001, transition: 'all 0.22s var(--ease-out, ease)',
        }} />
      )}

      <div role="dialog" aria-label="Walkthrough" style={{
        position: 'fixed', top, left, width: POP_W, zIndex: 1002,
        background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 14,
        boxShadow: 'var(--shadow-lg)', padding: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--accent-subtle-bg)', border: '1px solid var(--accent-subtle-border)', color: 'var(--accent)', flex: 'none' }}>
            <Icon name="Compass" size={15} />
          </div>
          <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-tertiary)' }}>{idx + 1} / {run.length}</span>
          <button onClick={finish} aria-label="Skip walkthrough" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', padding: 2 }}><Icon name="X" size={16} /></button>
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{step.title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{step.body}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={finish} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12.5 }}>Skip</button>
          <div style={{ flex: 1 }} />
          {idx > 0 && <AC.Button variant="ghost" size="sm" onClick={prev}>Back</AC.Button>}
          <AC.Button variant="primary" size="sm" onClick={next} trailingIcon={!last ? <Icon name="ArrowRight" size={14} /> : null}>{last ? 'Got it' : 'Next'}</AC.Button>
        </div>
      </div>
    </>
  );
}

export default Tour;
