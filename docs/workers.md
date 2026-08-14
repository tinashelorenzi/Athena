# Realtime feed service (soc-realtime)

The **soc-realtime** service streams a running scenario's feed to students over
**WebSockets**. When a student hits **Run**, the client opens a socket, subscribes
to the scenario, and receives the fired alerts/logs **pushed live** — computed
from the run clock, with **no per-student storage** (the old `RunEvent` copies
are gone). Pause/resume/finish go through the normal HTTP actions (they update
`ScenarioRun`); the service reflects them on the next tick.

If the socket can't connect (e.g. nginx `/ws` isn't set up yet), the client
**falls back to HTTP polling**, so the feed still works — just not sub-second.

## Running

Under PM2 (with the web app):

```bash
npm run build
pm2 start ecosystem.config.js      # athena-web (:3000) + soc-realtime (:3002)
pm2 logs soc-realtime
```

Standalone (dev): `npm run soc:realtime`. In docker: it's the `realtime` service
under `docker compose --profile app` (publishes `:3002`).

Upgrading from the old feed workers: `pm2 delete soc-master1 soc-master2`.

## nginx

Proxy the `/ws` path to the service with the WebSocket upgrade headers:

```nginx
location /ws {
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;   # keep long-lived sockets open
}
```

The client connects to `ws(s)://<same-host>/ws`, so this must be the same origin
as the app. Auth rides on the existing `athena_session` cookie (the service
validates it against the DB on connect).

## Feed timing

- **Alerts** fire at their `seek` (seconds from run start).
- **Logs** fire at their timestamp offset from the earliest log line.

## Env vars

| Var                   | Default | Meaning                          |
| --------------------- | ------- | -------------------------------- |
| `SOC_REALTIME_PORT`   | `3002`  | WebSocket server port            |
| `SOC_REALTIME_TICK_MS`| `1000`  | how often the feed is pushed     |
