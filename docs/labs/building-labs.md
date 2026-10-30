# Building a lab with the Autobuilder

A practical, start-to-finish guide: what goes in a lab folder, what each file
looks like, and how to get it from an idea to students. For every option of
the language, see the reference in [authoring.md](./authoring.md). A complete
working lab to copy from is [`docs/examples/lab-p21-web`](../examples/lab-p21-web/).

## How a lab works, in one paragraph

A lab is a practical on the student's own Ubuntu VM. The student links the VM
to Athena (My machines → `curl … | sudo bash`), opens the lab, and clicks
**Start**. Athena sends the agent (`zaio`) a signed list of things to collect:
files, command output, service states. Athena turns what comes back into
structured data and grades it with the checks you wrote. You never write code
that runs on the VM beyond the commands you list in the lab; grading happens in
Athena.

## The folder

```
my-lab/                          the folder you drop on the Autobuilder
├── scenario.json                REQUIRED  title, slug, type: the "card" for the lab
├── brief.md                     REQUIRED  the student's instructions (Markdown)
├── scripts/                     optional  shell scripts students run from the brief (see scripts.md)
│   └── setup.sh
├── lab/
│   ├── lab.yaml                 REQUIRED  what to collect from the VM and how to grade it
│   └── assets/                  optional  files sent to the VM (pcaps, sample logs, fixtures)
│       └── sqli.pcap
├── reference/
│   ├── good.evidence.json       optional  evidence from a VM built from your answer key; must score full marks (leave out the first time: see step 4)
│   ├── broken.evidence.json     optional  evidence from an untouched VM…
│   └── broken.expect.json       optional  …and which checks it must pass and fail (required if broken.evidence.json is there)
└── instructor/                  optional  your answer key and notes; never uploaded
    └── answer-key.md
```

Rules of thumb:

- Names and locations are fixed. The Autobuilder looks for exactly these paths.
  (`brief` and `lab` can be pointed elsewhere from `scenario.json`, but there's
  rarely a reason to.)
- Anything under `instructor/` is ignored by the upload, so the answer key can
  live with the lab safely.
- Keep the whole folder in git. Every upload of the same slug becomes a new
  version, so the folder is the lab's source of truth.

## 1. `scenario.json`: the card

```json
{
  "kind": "LAB",
  "type": "DOJO",
  "slug": "p22-ssh-hardening",
  "title": "Practical 22 — Harden SSH on the jump box",
  "description": "Lock down sshd and prove it with its own config test.",
  "exposure": "ROLLOUT",
  "techniques": ["T1021.004", "T1110"],
  "brief": "brief.md",
  "lab": "lab/lab.yaml"
}
```

| Field | What to put |
|---|---|
| `kind` | Always `"LAB"`. This is what makes it a lab rather than a SOC scenario. |
| `type` | `DOJO`: practice, students see their results. `ASSESSMENT`: graded, results hidden until you release them. |
| `slug` | Lowercase letters, digits and dashes. **Students type it** (`zaio start p22-ssh-hardening`). Uploading the same slug again makes a **new version** of that lab, so pick a fresh slug for a new lab, especially when you copy an existing folder. |
| `title`, `description` | Shown on the student's card and the lab page. |
| `techniques` | MITRE ATT&CK IDs, linked to the ATT&CK Explorer. Optional. |
| `exposure` | Starting visibility on the **first** upload: `ROLLOUT` (only cohorts you release it to) or `PUBLIC`. After that you control it on the lab page, and re-uploads don't change it. |
| `brief`, `lab` | Paths to the brief and the definition. Leave as shown. |

## 2. `brief.md`: what the student reads

Ordinary Markdown. You can drop in **per-student values** (params, see below),
so every student gets different numbers or tokens to use:

```markdown
## Your task

Harden the SSH server on your VM.

- Your banner tag: `{{param.token}}`. Put it in `/etc/issue.net`
  and enable it as the SSH banner.
- Disable root login and password authentication.

When you're done, click **Check**.
```

Two kinds of placeholder work in the brief:

- `{{param.<name>}}`: the student's value of a parameter.
- `{{script.<name>}}`: a ready-to-copy `curl -fsSL <link> | sudo bash` command
  for `scripts/<name>.sh`. Each student gets their own link, and the script is
  filled with their values. `{{script.<name>.url}}` gives just the link. See
  [scripts.md](./scripts.md).

## 3. `lab/lab.yaml`: collect, parse, check

This is the heart of the lab. Read it top to bottom as: *which VM roles exist →
which per-student values exist → what to gather from each VM → how to read what
was gathered → what counts as correct.*

```yaml
zcl: 1                                   # language version, always 1

session:                                 # optional
  timeLimitMinutes: 120                  # needed if you use lockdown
  checks: { practice: true, maxPractice: 30, cooldownSeconds: 30, showResults: dojo }

machines:                                # the VMs the student links, by role name
  jump: { os: ubuntu, versions: ["22.04", "24.04"], packages: [openssh-server] }

params:                                  # values generated per student, fixed once issued
  token: { type: token, length: 6, unique: cohort }

lifecycle:                               # optional
  baseline:                              # snapshot at Start, so you can tell what changed
    jump: { hash: [/etc/ssh/**] }
  # lockdown: { ssh: off }               # SSH off during the session (needs timeLimitMinutes)

collect:                                 # what the agent gathers, in order
  - on: jump
    gather:
      sshd_test: { run: [sshd, -t] }                       # command output; never via a shell
      sshd_eff:  { run: [sshd, -T] }                       # effective config
      banner:    { file: /etc/issue.net }                  # a file's content and metadata
      sshd_svc:  { service: ssh.service }                  # systemd state

parse:                                   # turn raw text into data you can test
  sshd: { from: sshd_eff.stdout, with: sshd }

checks:                                  # what's correct; CEL expressions
  - id: sshd_valid
    title: sshd config is valid and running
    points: 10
    assert:
      - sshd_test.exit_code == 0
      - sshd_svc.active_state == "active"
    hint: sshd -t must pass and the service must be running.

  - id: no_root
    title: Root can't log in over SSH
    points: 20
    assert: sshd.permitrootlogin == "no"
    hint: Look at who is allowed to log in directly.

  - id: banner_tag
    title: Your banner tag is shown
    assert:
      - { expr: 'banner.content.contains(param.token)', points: 10, label: Tag in /etc/issue.net }
      - { expr: 'sshd.banner == "/etc/issue.net"', points: 10, label: Banner enabled }
    hint: The banner file and the sshd setting both matter.

  - id: banner_written_in_session
    title: The banner was written during the session
    flag: CHANGED_BEFORE_START                      # raised when the assertion is false; scores nothing
    visibility: instructor
    assert: banner.changed                          # needs the baseline above
```

How the pieces connect:

| You write | You then refer to it as |
|---|---|
| a `gather` item `sshd_test: { run: … }` | `sshd_test.exit_code`, `sshd_test.stdout`, `sshd_test.stderr` |
| a `gather` item `banner: { file: … }` | `banner.exists`, `banner.content`, `banner.sha256`, `banner.changed` (with a baseline) |
| a `gather` item `sshd_svc: { service: … }` | `sshd_svc.active_state`, `sshd_svc.unit_file_state` |
| a `parse` entry `sshd: { from: sshd_eff.stdout, with: sshd }` | `sshd.permitrootlogin`, `sshd.banner`, … |
| a param `token` | `param.token` in checks, `{{param.token}}` in the brief and in `collect` |
| a file `lab/assets/sqli.pcap` | `{{asset.sqli_pcap}}` in `collect` (dots and dashes become `_`) |

The available collectors (`file`, `glob`, `run`, `service`, `package`, `log`),
parsers (`nginx`, `snort_rules`, `sshd`, `kv`, `ini`, `json`, `yaml`, `csv`,
`table`, `regex`, `lines`, …), CEL functions and check options are listed in
[authoring.md](./authoring.md).

Good habits:

- **Check behaviour, not only config.** For example, `curl` the server and test
  the headers it actually sends, or replay a pcap through the student's Snort
  rules. Config can look right and still not work.
- **Put a per-student token in the work.** A check that the student's token
  appears in their config is what makes copied work obvious.
- **Hints point where to look; they never give the answer.** They can't
  contain `{{…}}`.
- **Use partial credit** (`expr` + `points` + `label`) when a check has several
  parts. Students see which parts they got.

### Per-student values and cohort size

`unique: cohort` makes every student in a cohort get a different value. The
range must offer **at least 4× your largest cohort**. With a 147-student cohort,
that's 588 or more values. A 6-character token is far beyond that. For number
ranges, widen `max`:

```yaml
sid_base: { type: int, min: 1000000, max: 99990000, step: 10000, unique: cohort }   # 9,900 values
```

### Assets

Put files the VM needs (pcaps, sample logs, fixture configs) in `lab/assets/`.
Athena stores them, and the agent downloads them to `/var/lib/zaio/assets/` and
checks them by hash before running anything. Refer to them by
`{{asset.<name>}}`. Storage (Settings → Storage) must be configured for labs
with assets.

## 4. `reference/`: proving the lab is gradable

Students only ever get a lab version whose **answer key scores full marks**.
That stops a typo in a check from failing a whole cohort. You don't write these
files by hand: you capture them from real machines (see *Getting the evidence*
below). This section shows what they contain, so you can read them.

**`good.evidence.json`** is what the agent collects from a VM built from your
answer key, plus the param values you built it with:

```json
{
  "format": 1,
  "params": { "token": "K7Q2XM" },
  "roles": {
    "jump": {
      "machine": { "hostname": "reference-01", "osVersion": "24.04" },
      "items": {
        "sshd_test": { "ok": true, "exit_code": 0, "stdout": "", "stderr": "", "duration_ms": 12, "timed_out": false, "truncated": false },
        "sshd_eff":  { "ok": true, "exit_code": 0, "stdout": "permitrootlogin no\nbanner /etc/issue.net\n…", "stderr": "", "duration_ms": 15, "timed_out": false, "truncated": false },
        "banner":    { "ok": true, "exists": true, "path": "/etc/issue.net", "content": "Authorised use only. K7Q2XM\n", "sha256": "…", "size": 29, "mode": "0644", "owner": "root", "group": "root", "mtime": "2026-10-26T09:00:00Z", "truncated": false },
        "sshd_svc":  { "ok": true, "load_state": "loaded", "active_state": "active", "sub_state": "running", "unit_file_state": "enabled" }
      },
      "baseline": { "files": { "/etc/ssh/sshd_config": "<sha256 at Start>" } }
    }
  }
}
```

- One key under `roles` per machine role, one key under `items` per `gather`
  name.
- An item that couldn't be collected is `{ "ok": false, "error": "not_found",
  "message": "…" }`. Checks that depend on it fail with that reason.
- `baseline` is only needed if your checks use `changed` or `existed_at_start`.

**`broken.evidence.json` + `broken.expect.json`** are the same thing from an
untouched VM, plus what it should get. This proves your checks actually fail
when the work isn't done:

```json
{
  "description": "Stock Ubuntu, nothing done.",
  "pass": ["sshd_valid"],
  "fail": ["no_root", "banner_tag"],
  "flags": []
}
```

### Getting the evidence

Capture it from real machines, using the lab itself:

1. **Upload the folder without `reference/good.evidence.json`** (step 6). It
   goes in as a **draft**. Students can't see or start a draft, even if it's
   released to their cohort, but you can.
2. **Build a VM from your answer key** (write the key in
   `instructor/answer-key.md`). Link it under **My machines** like a student
   would.
3. **Open the lab as a student would** (the draft banner on the lab page links to
   it), choose that VM, **Start**, then **End** once it's set up. The final
   check collects everything, including `when: final` steps.

   Your per-student values (for example your `token`) are on that page, so build
   the answer key with **those** values, or do this step before step 2.
4. On the lab page: **Sessions** → open your session → **Save as good
   reference**. Athena grades it on that version. At full marks, the reference
   is stored and the version **goes live** for students. If not, nothing is
   saved, and you're told which checks failed and why. Fix the VM or the checks
   (re-upload, or use the Check editor) and try again.
5. Optional but recommended: run a session on an **untouched** VM and choose
   **Save as broken reference**. Whatever passes and fails there becomes
   `broken.expect.json`, so later versions are proven to still fail when the
   work isn't done.
6. Back up the references into the folder: the **Reference gate** tab has
   download buttons for `good.evidence.json`, `broken.evidence.json` and
   `broken.expect.json`. Put them in `reference/` and commit. Future uploads
   then go straight in without being drafts.

Any session can be used this way, and so can its **Download evidence** button,
including a student's perfect run.

## 5. Check the folder locally (optional, fast)

From the Athena repo:

```bash
npm run lab:check -- path/to/my-lab
```

This runs the same compiler and reference gate as the upload, without touching
the database. It prints every check's result for the good and broken
references, and ends with "The lab would be accepted" or the errors to fix,
each with a file and line. (It doesn't know your real cohort sizes. The upload
also checks `unique: cohort` ranges against them.)

## 6. Upload with the Autobuilder

1. **Admin → Scenarios → Auto-build.**
2. Drag the whole lab folder (the one containing `scenario.json`) onto the drop
   zone.
3. Read the report: compile errors with file and line, the good reference's
   score (must be full), the broken reference's result, and warnings.
4. Once it's accepted, you're taken to the lab page. With no good reference,
   it's accepted as a **draft**. Capture one as described in step 4.

Upload problems you might hit:

| Message | Fix |
|---|---|
| `unique: cohort needs at least N possible values` | Widen the param's range (see above). |
| `the reference scores X/Y, not full marks` | A check or the answer key is wrong. The report shows which assertion failed and why. |
| `Uploading lab assets failed: …` | Settings → Storage isn't set up or its keys are wrong; use **Test connection** there. |
| `Slug "…" belongs to a non-lab scenario` | Pick another slug. |

## 7. Release it to students

On the lab page, the **Who can see this lab** card:

- **Exposure**: Rollout (only the cohorts you release it to) or Public (every
  student).
- **Released to cohorts**: pick the cohorts. They see the lab on their Learn
  home.
- **Hidden** (Public Dojos only): not listed, but anyone with the student link
  can open it.

Students open the lab, choose their linked VM for each role, and click
**Start**. From the VM they can also run `zaio labs` and
`zaio start <slug>`.

## 8. After it's live

| You want to… | Do this |
|---|---|
| Fix a check or the brief | Edit the folder and re-upload (same slug, which makes a new version), or use **Check editor** → Publish. Running sessions keep their version. |
| Apply a fixed check to finished sessions | **Re-grade** on the lab page: preview the score changes, then apply. |
| See what a student's VM sent | **Sessions** tab → open a session → **Evidence**. |
| Adjust one student's score | Session drawer → **Override**, with a reason. |
| Export results | **Export CSV** on the lab page. |

## Checklist before you upload

- [ ] `scenario.json` has `"kind": "LAB"` and a **new** slug.
- [ ] Every `{{param.x}}` in the brief is defined under `params`.
- [ ] Every `{{script.x}}` in the brief has a `scripts/x.sh`, and the brief has students run it before they start the lab ([scripts.md](./scripts.md)).
- [ ] Every `unique: cohort` param has at least 4× your largest cohort in values.
- [ ] At least one check proves the student's own token is in their work.
- [ ] Hints don't give answers and contain no `{{…}}`.
- [ ] Either `reference/good.evidence.json` is there and scores full marks, or you'll capture it from a draft session.
- [ ] A broken reference is present or will be captured, and fails the checks you expect.
- [ ] The answer key is in `instructor/`, not in the brief.
- [ ] `npm run lab:check -- my-lab` says it would be accepted (or accepted as a draft).
