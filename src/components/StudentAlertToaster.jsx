'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { App } from 'antd';
import { BellOutlined } from '@ant-design/icons';

/* App-wide live alert notifications for students. Polls the active run and
   raises a notification for each newly-fired alert — so alerts surface no matter
   which page the student is on. The current backlog is seeded silently on first
   sight so history doesn't flood in; only alerts that fire afterwards notify.
   Clicking a notification opens the scenario. */
const POLL_MS = 6000;
const AUTO_DISMISS_S = 8;
const MAX_VISIBLE = 4;

export function StudentAlertToaster() {
  const router = useRouter();
  const { notification } = App.useApp();
  const seen = useRef(new Set());
  const activeScenario = useRef(null);
  const visible = useRef([]); // keys currently shown, oldest first (cap at MAX_VISIBLE)

  useEffect(() => {
    let active = true;
    const push = (t) => {
      visible.current.push(t.id);
      while (visible.current.length > MAX_VISIBLE) notification.destroy(visible.current.shift());
      notification.info({
        key: t.id,
        placement: 'topRight',
        duration: AUTO_DISMISS_S,
        icon: <BellOutlined />,
        title: `New alert · ${t.scenarioTitle}`,
        description: `${t.alert}${t.host ? ` — ${t.host}` : ''}`,
        style: { cursor: 'pointer' },
        onClick: () => { notification.destroy(t.id); router.push(`/learn/${t.scenarioId}`); },
        onClose: () => { visible.current = visible.current.filter((k) => k !== t.id); },
      });
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
  }, [notification, router]);

  return null;
}

export default StudentAlertToaster;
