# Writing a lab

A lab is a folder you upload with the Autobuilder (Admin → Scenarios → Auto-build)
or `npm run import:scenario -- <folder>`. Athena compiles it, grades your
reference evidence, and only accepts it if the reference scores full marks.
New to labs? Start with the step-by-step [building-labs.md](./building-labs.md).
The design is in [spec.md](./spec.md); a complete working example is
[`docs/examples/lab-p21-web`](../examples/lab-p21-web/).

```
my-lab/
  scenario.json        { "kind": "LAB", "slug": "p21-web", "type": "DOJO", "title": …, "brief": "brief.md" }
  brief.md             the student's instructions; may use {{param.token}} and {{script.setup}}
  scripts/setup.sh     optional: a script students run with curl from the brief (scripts.md)
  scripts/files/       optional: files those scripts download with {{file.<name>}}
  lab/
    lab.yaml           what to collect and how to grade it
    assets/            files sent to the machine (pcaps, fixture files)
  reference/
    good.evidence.json     evidence from a machine built from your answer key (or capture it: see below)
    broken.evidence.json   optional: evidence from an untouched machine…
    broken.expect.json     …and which checks it must fail
  instructor/          your notes and answer key (ignored by the upload)
```

Check a folder before uploading — same compiler, same gate, no database:

```bash
npm run lab:check -- docs/examples/lab-p21-web
```

## scenario.json

| Field | Notes |
|---|---|
| `kind` | `"LAB"` (required) |
| `slug` | Lowercase letters, digits, dashes. Students type it (`zaio start p21-web`). Uploading the same slug again adds a **new version**; running sessions keep theirs. |
| `type` | `DOJO` (practice: results shown) or `ASSESSMENT` (graded; results hidden until you release them) |
| `title`, `description`, `techniques` | As for SOC scenarios. A new version updates them. |
| `exposure`, `hidden` | Starting visibility, used on the **first upload only**. After that, set who sees the lab on its page (**Who can see this lab**: exposure, released cohorts, hidden), and new versions keep it. |
| `brief` | Path to a `.md` file or inline markdown |
| `lab` | Path to the definition, default `lab/lab.yaml` |

## lab.yaml

Seven sections. Only `collect` and `lifecycle` are ever sent to a machine;
`parse` and `checks` stay in Athena.

```yaml
zcl: 1                      # language version

session:                    # optional
  timeLimitMinutes: 180
  checks: { practice: true, maxPractice: 30, cooldownSeconds: 30, showResults: dojo }

machines:                   # the roles a student fills with their enrolled machines
  web: { os: ubuntu, versions: ["22.04", "24.04"], packages: [nginx, snort] }
  # attacker: { os: kali }  # os: ubuntu (default), kali or any — see kali.md

params:                     # per-student values, stored the first time a student opens the lab
  token:    { type: token, length: 6, unique: cohort }
  sid_base: { type: int, min: 1000000, max: 99990000, step: 10000, unique: cohort }

lifecycle:                  # optional
  baseline:
    web: { hash: [/etc/nginx/**], logs: [/var/log/nginx/access.log] }
  lockdown: { ssh: off }    # SSH off for the session, restored afterwards (needs session.timeLimitMinutes)

collect:                    # ordered steps; each runs on one role
  - on: web
    gather:
      nginx_dump:  { run: [nginx, -T] }
      local_rules: { file: /etc/snort/rules/local.rules }

parse:                      # turn raw text into data
  nginx: { from: nginx_dump.stdout, with: nginx }
  rules: { from: local_rules.content, with: snort_rules }

checks:
  - id: server_tokens
    title: The Server header hides the nginx version
    points: 10
    assert: nginx.http.values.server_tokens == "off"
    hint: Look at what the Server response header gives away.
```

### Lockdown

`lockdown: { ssh: off }` turns SSH off on every machine for the session, so
students work on the VM console (no pasting configs in). It needs a time limit:
SSH is restored when the session closes, and agents restore it on their own
shortly after the deadline even if Athena can't reach them. If SSH is used
anyway — a login during the session, a connection left open from before the
start, or SSH switched back on — the session gets an instructor flag
(`SSH_DURING_LOCKDOWN`, `LOCKDOWN_TAMPERED`). Flags don't change the score.

### params

| Type | Options |
|---|---|
| `token` | `length` (4–64, default 6), `alphabet` (`base32` default, `hex`, `alnum`) |
| `int` | `min`, `max`, `step` |
| `choice` / `word` | `values: [...]` |

`unique: cohort` keeps a value unique within a cohort; the compiler refuses a
space smaller than 4× your largest cohort. Use them as `{{param.x}}` in the
brief and in `collect`, and as `param.x` in assertions. **Give every lab at
least one token that must appear in the student's work** — it's what turns
"these configs look alike" into proof of copying.

### collect primitives

| Primitive | Example | Result fields |
|---|---|---|
| `file` | `{ file: /etc/x.conf, max_bytes: 65536 }` | `exists`, `content`, `sha256`, `size`, `mode`, `owner`, `group`, `mtime`, `changed`* |
| `glob` | `{ glob: /etc/nginx/**/*.conf, content: true }` | `files[]` (file fields each) |
| `run` | `{ run: [snort, -T, -c, /etc/snort/snort.conf], timeout: 60 }` | `exit_code`, `stdout`, `stderr`, `timed_out` |
| `service` | `{ service: nginx.service }` | `active_state`, `sub_state`, `unit_file_state` |
| `package` | `{ package: [nginx, snort] }` | `installed` (name → version) |
| `log` | `{ log: /var/log/nginx/access.log }` | `content` written since the session started |

`run` takes a list — commands never go through a shell. Placeholders:
`{{param.x}}`, `{{asset.<file>}}` (a file in `lab/assets/`, e.g. `sqli.pcap` →
`{{asset.sqli_pcap}}`), `{{session.nonce}}`, `{{machine.<role>.hostname}}`.
`when: final` on a step runs it only for the final check (useful for slow replays).

\* `changed`, `existed_at_start`, `baseline_sha256` compare a file with the
session baseline (declare it under `lifecycle.baseline`).

### parsers

| Parser | Gives you |
|---|---|
| `nginx` | `nginx -T` → `http` (`values`, `headers`, `directives`), `servers[]` (`listen`, `server_name`, `locations[]`), includes resolved |
| `snort_rules` | one record per active rule: `action`, `msg`, `sid`, `rev`, `contents[]`, `pcres[]`, `opts` |
| `sshd` | `sshd -T` → lowercase option → value |
| `kv`, `ini`, `json`, `jsonl`, `yaml`, `csv`, `lines` | the obvious structures |
| `table` | whitespace columns with a header row (`ss`, `ps`, `df`) |
| `regex` | one record per match, named groups → fields: `{ with: regex, pattern: '(?<sid>\d+)' }` |

### checks

Assertions are [CEL](https://cel.dev) — short, side-effect-free expressions:

```yaml
assert: snort_test.exit_code == 0                          # one expression
assert: [nginx_test.exit_code == 0, svc.active_state == "active"]   # all must pass
assert:                                                    # partial credit
  - { expr: 'rules.exists(r, r.msg.contains(param.token))', points: 10, label: Your token is in the rule }
  - { expr: 'alerts.exists(a, int(a.sid) >= param.sid_base)', points: 20, label: The rule fires }
```

Useful CEL: `list.exists(x, …)`, `list.all(x, …)`, `list.filter(x, …).size()`,
`s.contains()`, `s.startsWith()`, `s.matches("regex")`, `s.lowerAscii()`,
`x in [..]`, `has(m.field)`, `int("42")`. Extra functions: `cidrContains(cidr, ip)`,
`semverGte(a, b)`, `lines(s)`, `count(s, sub)`, `sha256(s)`.

| Field | Meaning |
|---|---|
| `points` | All-or-nothing points (leave out when every assertion has its own) |
| `hint` | Shown only when the check fails. Point where to look; never give the answer. No `{{…}}`. |
| `when` | CEL: skip the check (not scored) unless true |
| `flag` | `UPPER_CASE` code: raise an instructor flag when the assertion is false; scores nothing |
| `visibility` | `instructor` hides the check from students |

If something a check needs couldn't be collected (command missing, file
unreadable), the check fails with a plain reason like
`local_rules: file not found` — never with the expected value.

## Editing checks in the browser

Lab page → **Check editor** shows the current version's lab.yaml next to real
evidence — the good or broken reference, any student's stored check run, or an
evidence file you upload. **Run** (Ctrl+Enter) grades it and shows every
assertion, evaluation notes, and each parser's output, so you can see exactly
what `nginx.http.values` or `rules` contain. **Publish** makes the next
version after the same reference gate as an upload; running sessions keep
theirs. To apply a fix to sessions already finished, use **Re-grade** on the
lab page (preview the diff, then apply). Versions uploaded before this feature
don't carry their lab.yaml — re-upload the folder once to enable the editor.

## The reference gate

1. Build a machine from your answer key and collect its evidence
   (`reference/good.evidence.json`). It must include `"params"`: the values you
   built it with. Athena grades it; **anything below full marks rejects the upload**.
2. Optionally collect an untouched machine (`broken.evidence.json`) and list
   what it must fail in `broken.expect.json`:

   ```json
   { "pass": ["nginx_ok"], "fail": ["server_tokens", "sqli_rule"], "flags": ["CHANGED_BEFORE_START"] }
   ```

No good reference yet? Upload without it: the version is a **draft** that
students can't see or start. Run a session on your answer-key machine, then on
the lab page open it under **Sessions** → **Save as good reference**. At full
marks the version goes live. **Save as broken reference** does the same for an
untouched machine and writes the expectations from what it got. The
**Reference gate** tab downloads the stored files for your folder. Walkthrough:
[building-labs.md](./building-labs.md#getting-the-evidence).
