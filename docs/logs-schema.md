# Logs bundle — `Scenario.logs`

A time-ordered collection of raw log lines drawn from any host and any log source
in the scenario. This is the bulk telemetry students scroll, search, and pivot
through during an investigation.

## Shape

```json
{
  "version": 1,
  "entries": [
    {
      "ts": "2026-07-01T14:32:07.412Z",
      "host": "win-ep-04",
      "source": "sysmon",
      "action": "process_start",
      "user": "svc-batch",
      "message": "powershell.exe -enc SQBFAF...",
      "fields": { "pid": 6624, "ppid": 4188 }
    }
  ]
}
```

The top-level object has an integer `version` and an `entries` array. Each element
of `entries` is a single log record.

## Entry fields

| Field | Type | Required | Description |
|---|---|---|---|
| `ts` | string (ISO 8601 UTC) | Yes | Event time, UTC with trailing `Z`. Millisecond precision optional. Used as the sort key. |
| `host` | string | Yes | Hostname the event was observed on. Should match a scenario endpoint's `hostname`. |
| `source` | string | Yes | Log source or channel that produced the line, e.g. `sysmon`, `auth`, `dns`, `edr`, `firewall`, `windows_security`. |
| `action` | string | Yes | Event action or category, e.g. `process_start`, `network_connect`, `dns_query`, `logon`, `file_create`. |
| `message` | string | Yes | The raw, human-readable log line exactly as it would appear in the source. |
| `user` | string | No | Associated user or account, when the source records one. |
| `fields` | object | No | Arbitrary structured key/value pairs specific to the source (PIDs, ports, hashes, etc.). |

### Notes

- `source` and `action` are free-form strings, but staying consistent across a
  scenario lets students filter effectively. Pick a vocabulary and reuse it.
- `fields` values may be strings, numbers, booleans, or nested objects. Keys should
  be plain descriptive names. Do not encode analyst judgement here.

## Presentation to students

- Entries are displayed **sorted ascending by `ts`**, merged across all hosts and
  sources into a single timeline. You do not need to pre-sort the array; the
  platform sorts on load.
- There is **no severity coloring, scoring, or highlighting**. Every line renders
  identically regardless of content — a `dns_query` for a weather site looks the
  same as a `network_connect` to a C2 address. Distinguishing them is the exercise.
- Students can search and filter by `host`, `source`, `action`, `user`, and free
  text within `message`, so accurate raw values matter more than any labeling.

## Worked example

A slice of telemetry from the finance-department ransomware intrusion. Note that
nothing here is marked as noteworthy — the encoded PowerShell line and the outbound
connection to `185.220.101.34` sit in the same flat, neutral stream as an ordinary
DNS lookup.

```json
{
  "version": 1,
  "entries": [
    {
      "ts": "2026-07-01T14:26:55.104Z",
      "host": "win-ep-04",
      "source": "windows_security",
      "action": "logon",
      "user": "j.mensah",
      "message": "An account was successfully logged on. Logon Type: 2 (Interactive). Account Name: j.mensah. Workstation: WIN-EP-04.",
      "fields": { "event_id": 4624, "logon_type": 2, "src_ip": "10.0.0.5" }
    },
    {
      "ts": "2026-07-01T14:26:58.771Z",
      "host": "win-ep-04",
      "source": "dns",
      "action": "dns_query",
      "user": "j.mensah",
      "message": "query: pay-invoice-verify.top IN A -> 185.220.101.34",
      "fields": { "qname": "pay-invoice-verify.top", "qtype": "A", "answer": "185.220.101.34" }
    },
    {
      "ts": "2026-07-01T14:31:59.988Z",
      "host": "win-ep-04",
      "source": "sysmon",
      "action": "process_start",
      "user": "j.mensah",
      "message": "Process Create: WINWORD.EXE /n C:\\Users\\j.mensah\\Downloads\\Invoice_July.docm",
      "fields": { "event_id": 1, "pid": 4188, "ppid": 812, "image": "C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE" }
    },
    {
      "ts": "2026-07-01T14:32:07.412Z",
      "host": "win-ep-04",
      "source": "sysmon",
      "action": "process_start",
      "user": "svc-batch",
      "message": "Process Create: powershell.exe -nop -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQA...",
      "fields": { "event_id": 1, "pid": 6624, "ppid": 4188, "image": "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" }
    },
    {
      "ts": "2026-07-01T14:32:09.640Z",
      "host": "win-ep-04",
      "source": "sysmon",
      "action": "network_connect",
      "user": "svc-batch",
      "message": "Network connection: powershell.exe 10.0.0.5:51344 -> 185.220.101.34:4444 (TCP)",
      "fields": { "event_id": 3, "pid": 6624, "proto": "tcp", "src_ip": "10.0.0.5", "src_port": 51344, "dst_ip": "185.220.101.34", "dst_port": 4444 }
    },
    {
      "ts": "2026-07-01T14:33:41.205Z",
      "host": "win-ep-04",
      "source": "sysmon",
      "action": "file_create",
      "user": "svc-batch",
      "message": "File created: C:\\ProgramData\\svc.exe by powershell.exe",
      "fields": { "event_id": 11, "pid": 6624, "target": "C:\\ProgramData\\svc.exe", "sha256": "3f2a9c1b7e084d5a9c0b1e2f4a6d8c0e5b7a9d1f3e5c7a9b1d3f5e7c9a1b3d5f" }
    }
  ]
}
```
