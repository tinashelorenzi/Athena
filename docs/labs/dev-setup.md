# Labs — local development setup

How to run Athena and a real `zaio` agent together on one Windows machine.
The design is in [spec.md](./spec.md).

## One-time setup

- **Go** (1.24+) on Windows: `winget install GoLang.Go`.
- **WSL Ubuntu 24.04** with systemd (`/etc/wsl.conf` → `[boot] systemd=true`).
- **Mirrored WSL networking**, so WSL reaches the Windows dev server on
  `localhost:3000`: `%USERPROFILE%\.wslconfig` →

  ```ini
  [wsl2]
  networkingMode=mirrored
  ```

  then `wsl --shutdown`.
- **Postgres**: `npm run db:up` (Docker Desktop), then `npx prisma migrate deploy`.
- **Test student**: `npm run seed:lab-dev` creates `lab.student@athena.test`
  (password in `scripts/seed-lab-dev.ts`; refuses to run against a non-local DB).

## Build the agent

```bash
npm run agent:build        # agent/dist/zaio-linux-{amd64,arm64} + SHA256SUMS + manifest.json
```

It also writes `zaio_<version>_{amd64,arm64}.deb`. `agent/dist/` is git-ignored. Athena serves it at `/agent/*` and the
installer at `/i`. Bump `agent/VERSION` when the agent changes.

## Enrol WSL against local Athena

1. `npm run dev`, sign in as the test student, open **Machines**.
2. In WSL as root (`wsl -d Ubuntu-24.04 -u root`), exactly what students do:

   ```bash
   curl -fsSL http://localhost:3000/i | bash        # installs, then asks for email + code
   zaio status
   journalctl -u zaio -f
   ```

   Click **Generate code** when it asks. Or in one line:
   `curl -fsSL http://localhost:3000/i | bash -s -- --email lab.student@athena.test --code XXXX-XXXX`.
   Setup leaves the hostname alone under WSL. Re-running the installer on a
   linked machine upgrades the agent and restarts the service.

## Run a lab session locally

1. Import the example lab (needs storage for its pcap):
   `npm run import:scenario -- docs/examples/lab-p21-web`.
2. Release it to the test student: bind it to their cohort, or for a quick
   test set the scenario's exposure to Public.
3. In WSL, install nginx, Snort and curl
   (`DEBIAN_FRONTEND=noninteractive apt-get install -y nginx snort curl`).
4. From the lab page in Athena, or in WSL:

   ```bash
   zaio labs
   zaio start p21-web
   zaio check p21-web     # stock config: 30/100
   # … apply instructor/answer-key.md with *your* token and SID base (shown in the brief) …
   zaio end p21-web       # 100/100
   ```

**Routes 404 in `npm run dev` after a `next build`?** Delete `.next/dev` and
restart the dev server (a stale dev cache).

**WSL shuts its VM down** when no Windows-side process is attached, which
stops the agent (machines then show offline). Keep a terminal open on it, or
run `wsl -d Ubuntu-24.04 -- sleep infinity` in the background while testing.

## Tests

- `npm run test:labs` — Athena-side protocol tests (signing vectors, enrolment parsing).
- `cd agent && go test ./...` — agent tests, including the same signing vectors.

Both suites read `protocol/fixtures/`; a protocol change must keep both green.
