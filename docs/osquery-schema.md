# OSQuery data — `ScenarioEndpoint.osquery`

Per-endpoint osquery snapshots. **One JSON document per endpoint**, stored on that
endpoint's `ScenarioEndpoint` record.

## Background: osquery's data model

[osquery](https://osquery.io/) (open source, originally by Facebook, now a Linux
Foundation project; also the engine behind [Fleet](https://fleetdm.com/)) exposes
the operating system as a **relational database**. Endpoint state — running
processes, open sockets, users, scheduled tasks, registry keys, installed programs,
and so on — is presented as a set of **SQL tables**. An analyst queries them with
ordinary SQL (`SELECT ... FROM processes WHERE ...`).

Athena mirrors that model. Each osquery table is an array of **row objects**, and
each row object's keys are the **columns** of that table. Authors provide a `tables`
map from osquery table name to its array of rows, including **only the tables
relevant to the scenario**. Column names below are the real osquery column names, so
students who know osquery see authentic data.

> Schema reference used for the table and column names in this document: the
> official osquery schema (<https://osquery.io/schema/>) and the Fleet table
> reference (<https://fleetdm.com/tables>). Column availability can vary by
> platform (Windows/macOS/Linux) and osquery version.

## Shape

```json
{
  "version": 1,
  "hostname": "win-ep-04",
  "tables": {
    "processes": [
      { "pid": 6624, "name": "svc.exe", "path": "C:\\ProgramData\\svc.exe", "cmdline": "...", "parent": 4188, "uid": "svc-batch", "on_disk": 1 }
    ],
    "listening_ports": [
      { "pid": 6624, "port": 4444, "protocol": "tcp", "address": "0.0.0.0" }
    ],
    "users": [
      { "uid": "1001", "username": "j.mensah", "directory": "C:\\Users\\j.mensah" }
    ]
  }
}
```

## Top-level fields

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | integer | Yes | Bundle version. Currently `1`. |
| `hostname` | string | Yes | Endpoint hostname. Must match the `ScenarioEndpoint.hostname`. |
| `tables` | object | Yes | Map of osquery-table-name → array of row objects. Include only the tables you need. |

Each key in `tables` must be a real osquery table name; each row object should use
that table's real column names. You may include a subset of a table's columns — omit
columns your scenario does not use. Presentation is raw: rows are shown as-is, with
no coloring, sorting hints, or judgement.

## Useful osquery tables for endpoint investigation

The tables most relevant to SOC scenarios, with their key columns and a one-line
purpose. This is a curated subset of the full osquery schema — see the reference
links above for every column.

### `processes` — running processes
Purpose: enumerate every running process, its binary, and lineage.

| Column | Description |
|---|---|
| `pid` | Process ID. |
| `name` | Process/image name. |
| `path` | Full path to the executable on disk. |
| `cmdline` | Complete command line. |
| `parent` | Parent process's PID. |
| `cwd` | Current working directory. |
| `uid` | User ID the process runs as. |
| `on_disk` | `1` if the backing binary still exists on disk, `0` if deleted, `-1` unknown. |
| `start_time` | Process start time (Unix epoch seconds). |

### `process_open_sockets` — sockets per process
Purpose: map network connections to the owning process.

| Column | Description |
|---|---|
| `pid` | Owning process ID. |
| `family` | Address family (2 = IPv4, 10/23 = IPv6). |
| `protocol` | Transport protocol number (6 = TCP, 17 = UDP). |
| `local_address` / `local_port` | Local endpoint. |
| `remote_address` / `remote_port` | Remote endpoint. |
| `state` | TCP socket state (e.g. `ESTABLISHED`, `LISTEN`). |
| `path` | Domain path for UNIX sockets. |

### `listening_ports` — open listeners
Purpose: show which ports processes are listening on.

| Column | Description |
|---|---|
| `pid` | Listening process ID. |
| `port` | Listening port. |
| `protocol` | Transport protocol number. |
| `address` | Bind address (e.g. `0.0.0.0`, `::`). |
| `family` | Address family. |
| `path` | UNIX socket path, if applicable. |

### `users` — local user accounts
Purpose: enumerate accounts defined on the host.

| Column | Description |
|---|---|
| `uid` | User ID. |
| `gid` | Primary group ID. |
| `username` | Account name. |
| `description` | Account description / full name. |
| `directory` | Home directory path. |
| `shell` | Login shell (Unix). |
| `uuid` / `type` | User UUID; account type (Windows: `local` / `roaming`). |

### `logged_in_users` — active sessions
Purpose: who is (or was) logged in and how.

| Column | Description |
|---|---|
| `user` | Login name. |
| `type` | Session type (e.g. `interactive`, `remote`, `console`). |
| `tty` | Terminal / device. |
| `host` | Remote hostname for remote sessions. |
| `time` | Session start time (epoch). |
| `pid` | Session process ID. |
| `sid` | Windows security identifier. |

### `scheduled_tasks` — Windows Task Scheduler (Windows)
Purpose: find persistence and automation via scheduled tasks.

| Column | Description |
|---|---|
| `name` | Task name. |
| `action` | Command/executable the task runs. |
| `path` | Path to the task within the scheduler tree. |
| `enabled` | `1` if enabled. |
| `state` | Task state. |
| `hidden` | `1` if hidden from the UI. |
| `last_run_time` / `next_run_time` | Last/next run timestamps (epoch). |
| `last_run_code` / `last_run_message` | Result of the last run. |

### `services` — Windows services (Windows)
Purpose: enumerate services and how they start.

| Column | Description |
|---|---|
| `name` | Service name. |
| `display_name` | Human-readable name. |
| `status` | Current state (`RUNNING`, `STOPPED`, …). |
| `start_type` | Startup mode (`AUTO_START`, `DEMAND_START`, `DISABLED`, …). |
| `path` | Path to the service executable. |
| `module_path` | Path to the ServiceDll, if any. |
| `service_type` | `OWN_PROCESS`, `SHARE_PROCESS`, etc. |
| `user_account` | Account the service runs under. |
| `pid` | Process ID when running. |

### `startup_items` / `autoexec` — auto-start entries
Purpose: enumerate programs that run at boot/login (a common persistence surface).

`startup_items` columns:

| Column | Description |
|---|---|
| `name` | Startup item name. |
| `path` | Path to the item. |
| `args` | Command-line arguments. |
| `type` | Item type (e.g. `Startup Item`, `Login Item`). |
| `source` | Where the entry originates (registry run key, startup folder, etc.). |
| `status` | `enabled` / `disabled`. |
| `username` | Owning user. |

`autoexec` aggregates auto-executing binaries from many sources (run keys, services,
scheduled tasks, crontab, etc.). Key columns: `path`, `name`, `source` (the table
the entry came from).

### `programs` — installed software (Windows)
Purpose: inventory installed applications.

| Column | Description |
|---|---|
| `name` | Product name. |
| `version` | Product version. |
| `publisher` | Vendor/publisher. |
| `install_location` | Install path. |
| `install_date` | Installation date. |
| `identifying_number` | Product/GUID code. |

(On macOS the equivalents are `apps` and `homebrew_packages`; on Linux, `deb_packages` / `rpm_packages`.)

### `crontab` — scheduled jobs (Unix)
Purpose: find cron-based persistence/automation.

| Column | Description |
|---|---|
| `minute` / `hour` / `day_of_month` / `month` / `day_of_week` | Schedule fields. |
| `command` | Command executed. |
| `path` | Crontab file the entry came from. |
| `event` | Special schedule keyword (e.g. `@reboot`), if used. |

### `file` — filesystem metadata
Purpose: inspect specific files/paths (timestamps, size, ownership). Requires a
path/pattern constraint in real queries.

| Column | Description |
|---|---|
| `path` | Absolute file path. |
| `directory` | Containing directory. |
| `filename` | File name. |
| `size` | Size in bytes. |
| `mode` | Permission bits. |
| `uid` / `gid` | Owner user/group. |
| `mtime` / `atime` / `ctime` / `btime` | Modify / access / change / birth times (epoch). |

### `hash` — file hashes
Purpose: obtain cryptographic hashes for a file path.

| Column | Description |
|---|---|
| `path` | File path hashed. |
| `md5` | MD5 digest. |
| `sha1` | SHA-1 digest. |
| `sha256` | SHA-256 digest. |
| `directory` | Containing directory. |

### `registry` — Windows registry (Windows)
Purpose: read registry keys/values (persistence, configuration).

| Column | Description |
|---|---|
| `key` | Registry key. |
| `path` | Full path to the value. |
| `name` | Value name. |
| `type` | Value type (`REG_SZ`, `REG_DWORD`, …, or `subkey`). |
| `data` | Value data. |
| `mtime` | Last write time of the key (epoch). |

### `shell_history` — command history
Purpose: recover commands run by users (from shell history files).

| Column | Description |
|---|---|
| `uid` | User ID whose history this is. |
| `username` | User name (via join). |
| `command` | The command line. |
| `time` | Timestamp, when available (epoch). |
| `history_file` | Source history file path. |

### `chrome_extensions` — browser extensions
Purpose: enumerate installed Chrome/Chromium extensions.

| Column | Description |
|---|---|
| `name` | Extension name. |
| `identifier` | Extension ID. |
| `version` | Extension version. |
| `path` | Install path on disk. |
| `permissions` | Requested permissions. |
| `author` | Declared author. |
| `update_url` | Update endpoint. |
| `uid` | Owning user's ID. |

### `browser_plugins` — browser plugins (macOS)
Purpose: enumerate installed browser plugins.

| Column | Description |
|---|---|
| `name` | Plugin name. |
| `identifier` | Bundle identifier. |
| `version` | Plugin version. |
| `path` | Path on disk. |
| `development_region` | Locale. |

### `os_version` — OS build
Purpose: identify the exact OS and build.

| Column | Description |
|---|---|
| `name` | OS name. |
| `version` | OS version string. |
| `major` / `minor` / `patch` / `build` | Version components. |
| `platform` | Platform (`windows`, `darwin`, `linux`). |
| `arch` | Architecture. |

### `system_info` — host identity/hardware
Purpose: basic host and hardware facts.

| Column | Description |
|---|---|
| `hostname` | Host name. |
| `computer_name` | Friendly computer name. |
| `uuid` | Hardware UUID. |
| `cpu_brand` | CPU model string. |
| `cpu_physical_cores` / `cpu_logical_cores` | Core counts. |
| `physical_memory` | RAM in bytes. |
| `hardware_vendor` / `hardware_model` | Manufacturer/model. |

### `arp_cache` — ARP table
Purpose: map IP addresses to MAC addresses seen on the network.

| Column | Description |
|---|---|
| `address` | IP address. |
| `mac` | MAC address. |
| `interface` | Network interface. |
| `permanent` | `1` if a static/permanent entry. |

Other tables worth knowing for endpoint work: `process_open_files`,
`process_memory_map`, `authorized_keys`, `certificates`, `windows_events`,
`kernel_info`, `interface_addresses`, `dns_resolvers`, and `etc_hosts`. See the
schema reference for the complete list.

## Worked example

An osquery snapshot of `win-ep-04` during the ransomware intrusion. Every row is
raw osquery output; there are no analyst markings — the dropped `svc.exe`, the
`0.0.0.0:4444` listener, the `SvcBatchSync` persistence task, and the registry Run
key sit alongside ordinary system data, and it is the student's job to connect them.

```json
{
  "version": 1,
  "hostname": "win-ep-04",
  "tables": {
    "system_info": [
      {
        "hostname": "win-ep-04",
        "computer_name": "WIN-EP-04",
        "uuid": "4C4C4544-0037-3110-8052-B4C04F503432",
        "cpu_brand": "Intel(R) Core(TM) i7-1185G7 @ 3.00GHz",
        "cpu_logical_cores": 8,
        "physical_memory": 17055956992,
        "hardware_vendor": "Dell Inc.",
        "hardware_model": "Latitude 5420"
      }
    ],
    "os_version": [
      { "name": "Microsoft Windows 11 Pro", "version": "10.0.22631", "major": 10, "minor": 0, "build": "22631", "platform": "windows", "arch": "64-bit" }
    ],
    "users": [
      { "uid": "1001", "gid": "513", "username": "j.mensah", "description": "Joseph Mensah", "directory": "C:\\Users\\j.mensah", "type": "local" },
      { "uid": "1007", "gid": "513", "username": "svc-batch", "description": "Batch Service Account", "directory": "C:\\Users\\svc-batch", "type": "local" }
    ],
    "logged_in_users": [
      { "user": "j.mensah", "type": "interactive", "tty": "console", "time": 1751379975, "pid": 3120, "sid": "S-1-5-21-1004336348-1177238915-682003330-1001" }
    ],
    "processes": [
      { "pid": 4188, "name": "winword.exe", "path": "C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE", "cmdline": "\"WINWORD.EXE\" /n Invoice_July.docm", "parent": 812, "cwd": "C:\\Users\\j.mensah\\Downloads", "uid": "1001", "on_disk": 1, "start_time": 1751380319 },
      { "pid": 6624, "name": "powershell.exe", "path": "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", "cmdline": "powershell.exe -nop -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQA...", "parent": 4188, "cwd": "C:\\Users\\j.mensah\\Downloads", "uid": "1007", "on_disk": 1, "start_time": 1751380327 },
      { "pid": 7012, "name": "svc.exe", "path": "C:\\ProgramData\\svc.exe", "cmdline": "C:\\ProgramData\\svc.exe --run", "parent": 6624, "cwd": "C:\\ProgramData", "uid": "1007", "on_disk": 1, "start_time": 1751380421 }
    ],
    "process_open_sockets": [
      { "pid": 6624, "family": 2, "protocol": 6, "local_address": "10.0.0.5", "local_port": 51344, "remote_address": "185.220.101.34", "remote_port": 4444, "state": "ESTABLISHED" },
      { "pid": 7012, "family": 2, "protocol": 6, "local_address": "10.0.0.5", "local_port": 51402, "remote_address": "185.220.101.34", "remote_port": 443, "state": "ESTABLISHED" }
    ],
    "listening_ports": [
      { "pid": 7012, "port": 4444, "protocol": 6, "address": "0.0.0.0", "family": 2 }
    ],
    "scheduled_tasks": [
      { "name": "SvcBatchSync", "action": "C:\\ProgramData\\svc.exe --run", "path": "\\Microsoft\\Windows\\SvcBatchSync", "enabled": 1, "state": "ready", "hidden": 1, "last_run_time": 1751380502, "next_run_time": 1751466902, "last_run_code": "0" }
    ],
    "services": [
      { "name": "Spooler", "display_name": "Print Spooler", "status": "RUNNING", "start_type": "AUTO_START", "path": "C:\\Windows\\System32\\spoolsv.exe", "service_type": "OWN_PROCESS", "user_account": "LocalSystem", "pid": 1888 }
    ],
    "startup_items": [
      { "name": "OneDrive", "path": "C:\\Users\\j.mensah\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe", "args": "/background", "type": "Startup Item", "source": "HKEY_USERS\\...\\Run", "status": "enabled", "username": "j.mensah" }
    ],
    "registry": [
      { "key": "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", "path": "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run\\SvcBatch", "name": "SvcBatch", "type": "REG_SZ", "data": "C:\\ProgramData\\svc.exe --run", "mtime": 1751380505 }
    ],
    "programs": [
      { "name": "Microsoft 365 Apps for enterprise", "version": "16.0.17328.20124", "publisher": "Microsoft Corporation", "install_location": "C:\\Program Files\\Microsoft Office", "install_date": "20260112" }
    ],
    "hash": [
      { "path": "C:\\ProgramData\\svc.exe", "md5": "d41d8cd98f00b204e9800998ecf8427e", "sha1": "da39a3ee5e6b4b0d3255bfef95601890afd80709", "sha256": "3f2a9c1b7e084d5a9c0b1e2f4a6d8c0e5b7a9d1f3e5c7a9b1d3f5e7c9a1b3d5f", "directory": "C:\\ProgramData" }
    ],
    "file": [
      { "path": "C:\\ProgramData\\svc.exe", "directory": "C:\\ProgramData", "filename": "svc.exe", "size": 284160, "uid": "1007", "gid": "513", "mtime": 1751380418, "ctime": 1751380418, "btime": 1751380418 }
    ],
    "arp_cache": [
      { "address": "10.0.0.1", "mac": "00:1a:2b:3c:4d:5e", "interface": "Ethernet", "permanent": 0 },
      { "address": "10.0.0.9", "mac": "00:1a:2b:3c:4d:9f", "interface": "Ethernet", "permanent": 0 }
    ]
  }
}
```

## Citation

Table and column names in this document were confirmed against the official osquery
schema and the Fleet table reference:

- osquery schema: <https://osquery.io/schema/>
- Fleet table reference: <https://fleetdm.com/tables>
