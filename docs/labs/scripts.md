# Lab scripts: a curl command in the brief

A lab can hand students a shell script to run on their VM, for example to install
packages, plant a vulnerable config, or seed log files before they start. You
write the script once. The brief shows each student a one-line command to run it:

```bash
curl -fsSL https://athena.zaio.io/r/uzcLhzv4w6 | sudo bash
```

Each student gets **their own short link**, and Athena fills **that student's
values** (`{{param.token}}`, `{{param.sid_base}}`, …) into the script when the VM
fetches it. The student doesn't sign in on the VM: the short link is enough.

A complete example is in the example lab:
[`docs/examples/lab-p21-web/scripts/setup.sh`](../examples/lab-p21-web/scripts/setup.sh)
and the "Set up your server" section of its
[`brief.md`](../examples/lab-p21-web/brief.md).

## Quick start

1. Put the script in your lab folder as `scripts/<name>.sh`:

   ```
   my-lab/
   ├── scenario.json
   ├── brief.md
   ├── scripts/
   │   └── setup.sh          ← new
   ├── lab/
   │   └── lab.yaml
   └── reference/…
   ```

2. In `brief.md`, put the shortcode where students should run it. A code block
   makes it easy to copy:

   ````markdown
   ## Set up your server

   On a fresh Ubuntu VM, run this once:

   ```bash
   {{script.setup}}
   ```
   ````

3. Upload the folder with the Autobuilder, as usual. The upload report lists
   the scripts it found.

Each student now sees `curl -fsSL <their link> | sudo bash` in place of
`{{script.setup}}`.

## Shortcodes

| In the brief | Each student sees |
|---|---|
| `{{script.setup}}` | `curl -fsSL https://<athena>/r/<their code> \| sudo bash` |
| `{{script.setup.url}}` | `https://<athena>/r/<their code>`: just the link, for writing your own command |

Use `.url` when you don't want the default `sudo bash`, for example:

```bash
curl -fsSL {{script.setup.url}} -o setup.sh && less setup.sh && sudo bash setup.sh
curl -fsSL {{script.setup.url}} | bash        # runs as the student, not root
```

Shortcodes only work in the **brief**. `lab.yaml` can't use them; the upload
rejects that.

## Writing the script

- **Name:** `scripts/<name>.sh`. The name uses lowercase letters, digits, `-`
  or `_`, up to 40 characters, and is what goes in the shortcode
  (`scripts/seed-logs.sh` → `{{script.seed-logs}}`). Other files in
  `scripts/`, and sub-folders, are ignored with a warning.
- **It runs as root** with the default shortcode (`sudo bash`). Write it like
  any install script: start with `set -euo pipefail`, and use
  `DEBIAN_FRONTEND=noninteractive` for `apt-get` so nothing stops to ask a
  question.
- **Per-student values:** `{{param.<name>}}` is replaced with the student's
  value of that parameter from `lab.yaml`, the same value their brief and
  checks use. Nothing else is allowed in a script (`{{asset.x}}`,
  `{{session.nonce}}` and so on are rejected), and the parameter must exist.
  This applies to comments too, so don't write `{{script.setup}}` in a comment.
- **Make it safe to run twice.** Students will re-run it ("did it work?").
  `apt-get install` and `systemctl enable --now` already are; for files you
  write, overwrite them rather than append.
- **Size:** text only, up to 256 KB. Ship anything big (pcaps, archives) as a
  lab asset instead (`lab/assets/`), or have the script download it.
- Windows line endings are converted to Unix ones when the script is saved, so
  bash won't trip over `\r`.

Example (`docs/examples/lab-p21-web/scripts/setup.sh`):

```bash
#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx snort curl >/dev/null
systemctl enable --now nginx >/dev/null

cat > /root/p21-values.txt <<VALUES
Node tag:  {{param.token}}
SID block: {{param.sid_base}} to $(( {{param.sid_base}} + 9999 ))
VALUES

echo "Ready. Your node tag is {{param.token}}."
```

`{{…}}` is the only syntax Athena touches. `$VAR`, `$(…)` and `$((…))` are left
for bash.

### Setup scripts and grading

A script only changes the VM; it is not part of grading. Two things to keep in mind:

- **Run it before `zaio start`.** Starting a session records the machine's
  starting state (`lifecycle.baseline`). If a student runs the script *after*
  starting, everything it writes into hashed paths (for example a fresh
  `/etc/nginx/`) counts as changed during the session, as if the student did
  it. That can satisfy `changed` checks, or hide the "nothing changed since
  start" signal behind flags such as `CHANGED_BEFORE_START`. Put the script in
  the brief *above* the "start the lab" step, and say so.
- **Build your reference machines the same way.** Run the script on the VM you
  capture `good.evidence.json` from, and on the untouched VM for
  `broken.evidence.json`, so the references match what students will have.

## Managing scripts on the lab page

Open the lab (Scenarios → your lab) and go to the **Scripts** tab. For each
script you get:

- its shortcode, to copy into the brief, with a **in the brief / not in the
  brief** tag;
- how many students have a link to it (a link is made the first time a
  student's brief shows it);
- **Edit**: change the text in the browser, or **Load from a file** to replace
  it with a `.sh` from your computer;
- **Download**: save it as `<name>.sh`, for example to put back in the lab folder;
- **Delete**: refused while the brief still uses the script.

**Add script** creates a new one by typing or loading a file. To hand it out,
add its shortcode to `brief.md` and re-upload the folder. Briefs are edited in
the folder, not on the page.

### How scripts and uploads fit together

- Scripts belong to the **lab**, not to a version, like the brief. **An edit
  applies straight away**: the next `curl` from any student gets the new text,
  including students mid-session.
- Uploading the folder **adds or updates** the scripts in its `scripts/`. A
  script that's on Athena but not in the folder is **kept**, so a brief may use
  a script you only added on the page. The upload checks the brief against the
  folder's scripts *plus* the lab's scripts on Athena.
- An upload **overwrites** a script of the same name. If you edited one on the
  page, download it into the folder first, or your edit is lost on the next
  upload.
- `npm run lab:check` works offline, so it only knows the folder's scripts. A
  brief that uses a page-only script fails there but uploads fine.
- If you remove a parameter in a later version (Check editor or upload), a
  script still using `{{param.<that>}}` is served with the placeholder left in.
  Fix the script on the page.

## Students' links

- The link is `https://<athena>/r/<code>`, with a random 10-character code
  per student per script. It stays the same for that student, so a command
  they copied earlier keeps working.
- **Anyone with the link can fetch the script**, with that student's values
  filled in. It needs no sign-in, so it works from a bare VM. Treat scripts as
  visible to students: don't put secrets or answers in them.
- The link only works while the lab is **visible to that student** (the same
  rules as opening the lab: Public, or released to their cohort; instructors
  always). If you unrelease the lab or the student leaves the cohort, their
  link stops working. Deleting a script also kills every link to it.
- On an error, Athena answers with a tiny shell script,
  `echo "athena: …" >&2; exit 1`, so piping it into bash prints the reason and
  fails. With `curl -f` (as in the default command), curl itself stops with
  `The requested URL returned error: 404`.
  - **404** `this script link doesn't exist`: a mistyped code, or the script
    was deleted.
  - **403/404** `this lab isn't available to you any more`: the lab isn't
    released to that student (or has no version they can use, such as a
    draft).
- In the **instructor** view of the brief (lab page → Brief), the commands are
  *your* links, filled with *your* values. That's what you want on an
  answer-key VM: run it there, then `zaio start`, and the session uses the same
  values.

## Checklist

- [ ] `scripts/<name>.sh` is named in lowercase, and each one is used in
      `brief.md` as `{{script.<name>}}` (the upload warns about unused ones).
- [ ] The script uses only `{{param.x}}` placeholders that exist in `lab.yaml`.
- [ ] It's safe to run twice, and installs non-interactively.
- [ ] The brief tells students to run it **before** starting the lab.
- [ ] Your reference VMs were built with the same script.
- [ ] Nothing secret or answer-revealing is in it.

## For developers: how it works

| Piece | Where |
|---|---|
| Tables `lab_scripts` (name, content per lab) and `lab_script_links` (code, script, user, fetch count) | `prisma/schema.prisma` (`LabScript`, `LabScriptLink`) |
| `{{script.x}}` / `{{script.x.url}}` parsing and rendering | `src/lib/labs/language/template.ts` (`scriptCommand`) |
| Script rules (name, size, placeholders), offline-safe | `src/lib/labs/language/scripts.ts` |
| Folder check: reads `scripts/*.sh`, checks the brief's shortcodes | `src/lib/labs/folder.ts` |
| Saving scripts on upload (upsert by name) | `src/lib/labs/save.ts` |
| Per-student links and brief rendering | `src/lib/labs/scripts.ts` (`scriptLinksFor`, `renderBriefFor`) |
| The public endpoint | `src/app/r/[code]/route.ts` |
| Lab page tab, and add/edit/delete actions | `src/components/screens/labs/admin/LabScripts.jsx`, `saveLabScript` / `deleteLabScript` in `src/app/actions/lab-admin.ts` |

Flow: the student's lab page calls `renderBriefFor`, which finds the
`{{script.x}}` names in the brief, gets or creates the student's
`LabScriptLink` for each, and renders `curl -fsSL <APP_BASE_URL>/r/<code> |
sudo bash`. `GET /r/<code>` looks up the link, runs `loadLabForUser` for the
link's owner (the same visibility rules as the lab page), gets their params
with `getOrCreateLabParams`, renders `{{param.x}}`, and counts the fetch.
Links use `APP_BASE_URL` when it's set, otherwise the request's host. Set it in
production so commands show the public address.
