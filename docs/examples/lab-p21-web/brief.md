## Situation

Vukani Logistics runs its parcel-tracking portal on a single Ubuntu server with **nginx**. Last week a pentester found that the portal leaks its software version and is wide open to SQL injection on `/track?id=`. You are the on-call engineer: harden the web server and put a **Snort** sensor in front of it.

## Your values

These are yours alone — your work is checked against them.

- **Node tag:** `{{param.token}}`
- **Snort SIDs:** the 10 000 SIDs starting at `{{param.sid_base}}`

## Tasks

1. Make sure nginx passes `nginx -t` and is running.
2. Stop nginx from advertising its version in the `Server` header.
3. Send these headers on every response: `X-Frame-Options: DENY` (or `SAMEORIGIN`), `X-Content-Type-Options: nosniff`, and `X-Vukani-Node` set to your node tag.
4. Snort must load its configuration cleanly (`snort -T -c /etc/snort/snort.conf`).
5. In `/etc/snort/rules/local.rules`, write an **alert** rule that detects SQL injection attempts against the tracking page. Its `msg` must contain your node tag and its `sid` must be one of your SIDs.

When you're ready, check your work with `sudo zaio check p21-web`, and finish with `sudo zaio end p21-web`.
