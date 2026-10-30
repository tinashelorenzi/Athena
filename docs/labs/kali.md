# Kali Linux machines

Students can link their own **Kali Linux** machine to Athena, next to (or
instead of) an Ubuntu VM. The same agent, `zaio`, runs on it and collects
evidence for a lab's checks, so a lab can grade the attacking side too: the scan
a student saved, the flag they recovered, the tool they configured.

A lab says which machines it needs in `lab.yaml`. A role can ask for Ubuntu,
Kali, or either:

```yaml
machines:
  target:   { os: ubuntu, versions: ["24.04"], packages: [nginx] }
  attacker: { os: kali, packages: [nmap] }
```

- [For students: linking a Kali machine](#for-students-linking-a-kali-machine)
- [For lab authors: labs with a Kali role](#for-lab-authors-labs-with-a-kali-role)
- [How it works](#how-it-works)

## For students: linking a Kali machine

You need:

- Kali Linux installed **on a disk**: a VirtualBox, VMware or UTM VM (the
  prebuilt images from kali.org are fine), or a real install. A live USB
  without persistence forgets the agent at every reboot.
- Networking that reaches Athena. If the lab also has a target VM, put both
  VMs on a network where they can see each other (for example a VirtualBox
  *NAT Network*), and keep internet access so the agent can reach Athena.
- Your Kali password, for `sudo` (on the prebuilt images the user is `kali`).

Then:

1. In Athena, open **Machines**.
2. On the Kali machine, open a terminal and run the command shown on that page:

   ```bash
   curl -fsSL https://<your-athena>/i | sudo bash
   ```

   It downloads the agent, checks it, installs it as the `zaio` package and asks
   for your Athena email, a code and a name for the machine (for example
   `kali`).
3. Back on the Machines page, click **Generate code** and type the code into
   the terminal. It's valid for 10 minutes.
4. The machine shows up on the Machines page as *Kali GNU/Linux Rolling* once
   its agent checks in. Check it from the terminal with `sudo zaio status`.

Setup renames the machine to `zaio-<you>-NN` so your instructor can tell
machines apart. Your prompt shows the new name in a new terminal.

When you open a lab, each role's box lists only the machines that fit it: a
Kali role takes your Kali machine, an Ubuntu role takes an Ubuntu VM. If the
lab needs two machines, start it from the lab page in Athena, where you choose
a machine for each role (`zaio start` on the machine only works for one-machine
labs). Turn every machine on before you click **Start**.

### Good to know

- **The agent runs in the background** as `zaio.service`, so you don't need a
  terminal open during the lab. It only talks outward to Athena: nothing
  connects into your Kali machine.
- **Keep Kali updated** as usual (`sudo apt update && sudo apt full-upgrade`).
  Athena shows the release (for example *Kali Linux 2025.3*) next to the
  machine. A lab may ask for a release or newer series; the picker greys out
  machines that don't fit and says why if you try.
- **Already linked an older agent** with `--any-os`? Run the install command
  again: it upgrades the agent to 0.4.0, which knows Kali. Agents before 0.4.0
  refuse Kali at setup unless given `--any-os`.
- **Removing the agent:** `sudo apt remove zaio`. It also restores anything a
  lab session turned off. Remove the machine on the Machines page too.
- **Kali on WSL** has no systemd by default, which the agent needs. Turn it on
  (`[boot]` → `systemd=true` in `/etc/wsl.conf`, then `wsl --shutdown`), or
  better, use a VM.

## For lab authors: labs with a Kali role

Everything in [authoring.md](./authoring.md) works on Kali. A few things are
specific to it.

### `machines`

| `os` | Takes |
|---|---|
| `ubuntu` (the default) | Ubuntu 22.04 or 24.04 |
| `kali` | Kali Linux, any release |
| `any` | either of them |

`versions` narrows it down. A version matches exactly or as a prefix:
`["2025"]` takes Kali 2025.1 to 2025.4, `["24"]` takes Ubuntu 24.04. Kali is a
rolling release, so leave `versions` out unless the lab needs a new tool.

`packages` works as for Ubuntu: it lists what the lab needs, and Athena
doesn't install or check it. Many tools are on the default Kali image but not
all of them, so say in the brief what to install. To grade on it, collect
`{ package: [nmap] }` (Kali uses `dpkg` too).

In checks, `machine.<role>` has `hostname`, `os` (`ubuntu` or `kali`) and
`osVersion`, which is useful with `os: any`.

### Collecting from the attacking side

The agent runs as root, but the student works as their own user (`kali` on the
prebuilt images, something else on a custom install). So:

- **Ask students to save their work to a fixed folder in their home**, and
  collect it with a glob over every home, for example
  `/home/*/athena/scan.gnmap`. Say the exact path in the brief and the hints.
- **Prefer files the student saves over shell history.** Kali's shell is zsh,
  which writes `~/.zsh_history` only when the shell exits, so history is
  unreliable as evidence.
- **Prefer tool output formats that are easy to check.** nmap's grepable
  output (`-oG`) has `8421/open/tcp` per port; JSON outputs go through the
  `json` parser.
- **Put per-student values in the target** (a token in a page, a port from
  `params`), so one student's saved scan or flag doesn't pass for another.
- Use `{{param.x}}` and `{{session.nonce}}` in what you gather, as on Ubuntu.

### Example: scan a target, recover a token

The student gets an Ubuntu target whose site runs on a per-student port and
hides a per-student token. They scan it from Kali and save what they find.

```yaml
zcl: 1

session:
  timeLimitMinutes: 90

machines:
  target:   { os: ubuntu, versions: ["24.04"], packages: [nginx] }
  attacker: { os: kali, packages: [nmap] }

params:
  port:  { type: int, min: 8100, max: 8900, step: 1, unique: cohort }
  token: { type: token, length: 8 }

collect:
  - on: target
    gather:
      site: { run: [nginx, -T] }
  - on: attacker
    gather:
      scans: { glob: "/home/*/athena/scan.gnmap", content: true }
      loot:  { glob: "/home/*/athena/flag.txt", content: true }

parse:
  nginx: { from: site.stdout, with: nginx }

checks:
  - id: service_up
    title: The target serves the site on its port
    points: 10
    assert: nginx.servers.exists(s, s.listen.exists(l, l.contains(string(param.port))))
  - id: scanned
    title: You scanned the target and found the open port
    points: 40
    assert: scans.files.exists(f, f.content.contains(string(param.port) + "/open/tcp"))
    hint: Save a grepable nmap scan (-oG) to ~/athena/scan.gnmap on your Kali machine.
  - id: flag
    title: You recovered the token from the site
    points: 50
    assert: loot.files.exists(f, f.content.contains(param.token))
    hint: The token is somewhere on the site. Put it in ~/athena/flag.txt.
```

A [setup script](./scripts.md) on the target can put the site in place with
`{{param.port}}` and `{{param.token}}`. The two machines must reach each other;
say how in the brief (for example "both VMs on the same VirtualBox NAT
Network").

### Reference evidence

The [reference gate](./building-labs.md#4-reference-proving-the-lab-is-gradable)
works the same way. In a hand-written evidence file, give the Kali role's
machine its OS:

```json
"attacker": {
  "machine": { "hostname": "reference-kali", "os": "kali", "osVersion": "2025.3" },
  "items": { "scans": { "ok": true, "files": [ … ] } }
}
```

The easiest way to get real evidence is to do the lab yourself on a Kali VM
and a target, as in [building-labs.md](./building-labs.md#getting-the-evidence).

### Lockdown

`lockdown: { ssh: off }` works on Kali. Kali ships SSH turned off, so there is
usually nothing to turn off: the agent records SSH's state at the start and puts
it back as it was. Students on a Kali desktop work in its own terminal anyway.

## How it works

| What | Where |
|---|---|
| The agent accepts Kali at setup (os-release `ID=kali`, any `VERSION_ID`) and reports `os` with its evidence. Agent 0.4.0. | `agent/internal/sysinfo/sysinfo.go`, `agent/cmd/zaio/setup.go`, `agent/internal/tasks/tasks.go` |
| The installer treats Kali like Ubuntu: it installs the `.deb` (Kali has `dpkg`) and doesn't warn. | `src/lib/labs/agent-dist.ts` |
| `os: ubuntu \| kali \| any` in `lab.yaml`, version matching, the messages. | `src/lib/labs/os.ts`, `src/lib/labs/language/compile.ts` |
| Starting a session refuses a machine whose OS or version doesn't fit its role (`os_unsupported`), from the lab page and from `zaio start`. | `startSession` in `src/lib/labs/sessions.ts` |
| The lab page's machine picker greys out machines that don't fit and shows each role's OS. | `src/components/screens/labs/LabWorkspace.jsx` |
| `machine.<role>.os` in checks. Evidence from older agents gets the OS the machine enrolled with. | `src/lib/labs/language/grade.ts`, `submitTaskResult` in `src/lib/labs/sessions.ts` |

Before this, a role's OS wasn't checked at start, only its `versions`. Now an
Ubuntu role (including a role with no `os`, which means `ubuntu`) refuses a Kali
machine, and a machine linked with `--any-os` on another system fits no role.
