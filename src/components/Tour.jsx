'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Tour as AntTour } from 'antd';

/* First-run product tour on antd's <Tour>: spotlights a sequence of elements
   (found by `data-tour` selector) with an explaining popover. Auto-starts once
   per `storageKey` (localStorage), and re-runs on the `athena:start-tour` window
   event (fired by startTour(), e.g. the user menu's "Replay walkthrough").
   Steps whose target isn't in the DOM are skipped, so conditional UI is
   handled for free. Steps without a selector render centered. */
const TOUR_EVENT = 'athena:start-tour';

/** Fire from anywhere (e.g. a navbar button) to (re)start the current page's tour. */
export function startTour() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(TOUR_EVENT));
}

export function Tour({ steps, storageKey }) {
  const [run, setRun] = useState(null); // resolved antd steps while active, else null
  const [current, setCurrent] = useState(0);

  const start = useCallback(() => {
    const resolved = (steps || [])
      .filter((s) => !s.selector || document.querySelector(s.selector))
      .map((s) => ({
        title: s.title,
        description: s.body,
        target: s.selector ? () => document.querySelector(s.selector) : null,
        scrollIntoViewOptions: { block: 'center', inline: 'center', behavior: 'smooth' },
      }));
    if (resolved.length === 0) return;
    setCurrent(0);
    setRun(resolved);
  }, [steps]);

  const finish = useCallback(() => {
    setRun(null);
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

  if (!run) return null;
  return (
    <AntTour
      open
      steps={run}
      current={current}
      onChange={setCurrent}
      onClose={finish}
      onFinish={finish}
      zIndex={1100}
    />
  );
}

export default Tour;
