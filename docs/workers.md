# Scenario feed workers (soc-master)

The **soc-master** workers drive the live scenario data feed. When a student
hits **Run**, a `ScenarioRun` is created with a server-authoritative clock. The
workers continuously advance the feed for every running scenario, materializing
the alerts and log lines that have "fired" (by their timing) into `RunEvent`
rows. The student workspace polls `/api/runs/[scenarioId]` to render the feed.

## Two workers

Two instances run under PM2 — **soc-master1** and **soc-master2** — and split
the running scenarios between them by hashing the run id (`SOC_WORKER_INDEX` /
`SOC_WORKER_COUNT`). Adding capacity is a matter of running more instances and
raising the count.

## Running

```bash
pm2 start ecosystem.config.js     # start both workers
pm2 status                        # see soc-master1 / soc-master2
pm2 logs soc-master1              # tail a worker
pm2 delete ecosystem.config.js    # stop them
```

Each worker loads `.env` itself (for `DATABASE_URL`) and runs the TypeScript
worker via `node --import tsx`. For a quick single-worker run without PM2:

```bash
npm run soc:worker                # runs one worker (shard 1/1)
```

## Feed timing

- **Alerts** fire at their `seek` (seconds from run start — see
  `docs/alerts-schema.md`).
- **Logs** fire at their timestamp offset from the earliest log line, so the log
  stream plays out over time too.

## Robustness

The poll API runs the same materialization as a **catch-up** on every request,
so the feed stays correct even if the workers are briefly down or behind — the
workers keep state fresh between polls and while no one is watching. The clock
itself is derived from the run row (`accumulatedSeconds` + current running
segment), so **pause/resume** (dojos only) and reloads never lose progress.

## Env vars

| Var                | Default | Meaning                                  |
| ------------------ | ------- | ---------------------------------------- |
| `SOC_WORKER_INDEX` | `0`     | 0-based shard index for this instance    |
| `SOC_WORKER_COUNT` | `1`     | total number of workers                  |
| `SOC_TICK_MS`      | `3000`  | how often each worker advances the feed  |
