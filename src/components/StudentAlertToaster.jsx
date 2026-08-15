'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as AC from '@/components/ds';

/* App-wide live alert notifications for students. Polls the active run and
   raises a toast for each newly-fired alert — so alerts surface no matter which
   page the student is on. The current backlog is seeded silently on first sight
   so history doesn't flood in; only alerts that fire afterwards toast. */
const POLL_MS = 6000;
const AUTO_DISMISS_MS = 8000;
const MAX_VISIBLE = 4;

export function StudentAlertToaster() {
  const router = useRouter();
  const [toasts, setToasts] = useState([]);
  const seen = useRef(new Set());
  const activeScenario = useRef(null);

  const remove = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  useEffect(() => {
    let active = true;
    const push = (t) => {
      setToasts((cur) => [...cur, t].slice(-MAX_VISIBLE));
      setTimeout(() => { if (active) remove(t.id); }, AUTO_DISMISS_MS);
    };

    const tick = async () => {
      try {
        const res = await fetch('/api/runs/active', { cache: 'no-store' });
        if (!res.ok || !active) return;
        const { run } = await res.json();
        if (!active) return;
        if (!run) { activeScenario.current = null; seen.current = new Set(); return; }
        // A different (or first) running scenario — seed its backlog silently.
        if (activeScenario.current !== run.scenarioId) {
          activeScenario.current = run.scenarioId;
          seen.current = new Set((run.alerts || []).map((a) => a.id));
          return;
        }
        for (const a of run.alerts || []) {
          if (seen.current.has(a.id)) continue;
          seen.current.add(a.id);
          push({
            id: `${run.scenarioId}:${a.id}:${Date.now()}`,
            scenarioId: run.scenarioId,
            scenarioTitle: run.title,
            alert: a.title,
            host: a.host,
          });
        }
      } catch { /* transient — try again next tick */ }
    };

    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => { active = false; clearInterval(timer); };
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 60, display: 'flex', flexDirection: 'column', gap: 10, width: 'min(92vw, 380px)' }}>
      {toasts.map((t) => (
        <div key={t.id} onClick={() => router.push(`/learn/${t.scenarioId}`)} style={{ cursor: 'pointer' }} role="link" title="Open scenario">
          <AC.Toast
            tone="info"
            title={`New alert · ${t.scenarioTitle}`}
            message={`${t.alert}${t.host ? ` — ${t.host}` : ''}`}
            onClose={(e) => { e?.stopPropagation?.(); remove(t.id); }}
          />
        </div>
      ))}
    </div>
  );
}

export default StudentAlertToaster;
