/* Client-side feed computation for instructor Preview mode — a pure mirror of
   the server's feedAt (src/lib/run-engine.ts), so no DB / server actions are
   involved. Returns the alerts/logs that have fired at `elapsed` seconds. */
export function feedAtClient(alertsBundle, logsBundle, elapsed) {
  const rawAlerts = Array.isArray(alertsBundle?.alerts) ? alertsBundle.alerts : [];
  const alerts = rawAlerts
    .map((a, i) => ({ a, at: Math.max(0, Math.floor(Number(a.seek ?? 0))), i }))
    .filter((x) => x.at <= elapsed)
    .sort((x, y) => x.at - y.at)
    .map((x) => ({ ...x.a, id: x.a.id ?? `a${x.i}`, at: x.at }));

  const rawLogs = Array.isArray(logsBundle?.entries) ? logsBundle.entries : [];
  const times = rawLogs.map((l) => Date.parse(String(l?.ts ?? '')));
  const valid = times.filter((n) => !Number.isNaN(n));
  const min = valid.length ? Math.min(...valid) : 0;
  const offsets = times.map((t) => (!Number.isNaN(t) && min ? Math.max(0, Math.floor((t - min) / 1000)) : 0));
  const logs = rawLogs
    .map((l, i) => ({ l, at: offsets[i] }))
    .filter((x) => x.at <= elapsed)
    .sort((x, y) => x.at - y.at)
    .map((x) => ({ ...x.l, at: x.at }));

  return { alerts, logs };
}
