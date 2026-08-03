# Alerts bundle — `Scenario.alerts`

Detections that surface into the student's alert queue as the scenario plays out.
Unlike logs (which are all present from the start), alerts appear over time
according to their `seek` offset, so an investigation unfolds at a realistic pace.

## Shape

```json
{
  "version": 1,
  "alerts": [
    {
      "id": "ALT-4821",
      "seek": 0,
      "title": "Encoded PowerShell command executed",
      "host": "win-ep-04",
      "source": "10.0.0.5",
      "destination": "185.220.101.34",
      "rule": "T1059.001",
      "count": 24,
      "fields": { }
    }
  ]
}
```

## Alert fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique alert identifier within the scenario, e.g. `ALT-4821`. Used for de-duplication and linking. |
| `seek` | integer (seconds, ≥ 0) | Yes | Seconds after scenario start when this alert becomes visible. See below. |
| `title` | string | Yes | Short, factual summary of what the detection fired on. Keep it descriptive, not judgemental. |
| `host` | string | Yes | Hostname the alert concerns. Should match a scenario endpoint's `hostname`. |
| `source` | string | No | Source IP or host, when applicable. |
| `destination` | string | No | Destination IP or host, when applicable. |
| `rule` | string | No | Detection rule id or name that produced the alert, e.g. an ATT&CK technique id like `T1059.001`. |
| `count` | integer | No | Number of underlying events the alert aggregates. |
| `fields` | object | No | Arbitrary raw key/value pairs specific to the detection. |

### Notes on neutrality

`title` and `rule` describe **what was observed**, never **how bad it is**. Write
"Encoded PowerShell command executed", not "Malicious PowerShell detected". Do not
add `severity`, `verdict`, or `priority` fields — the queue renders every alert
uniformly and it is the student's job to triage.

## The `seek` concept

`seek` is the single most important field for pacing a scenario. It is an integer
**number of seconds measured from the moment the scenario begins** ("time zero").
When the scenario clock reaches an alert's `seek` value, that alert pops into the
student's queue. Think of it as the alert's cue point on the scenario timeline.

- `seek: 0` — the alert is present the instant the student starts. Use this for the
  initial detection(s) that kick off the exercise.
- `seek: 45` — appears 45 seconds in.
- `seek: 130` — appears 2 minutes 10 seconds in.

This lets a scenario "play out over time": the student begins with one or two
alerts, and as they investigate, follow-on detections arrive — mirroring how a real
incident escalates in a SIEM/SOAR queue. Ordering the array by `seek` is good
practice for readability, but the platform sorts on load, so it is not required.

Some guidance:

- `seek` is relative to scenario start, **not** to the `ts` of any log entry. The
  two timelines are independent; you tune `seek` purely for pacing.
- Multiple alerts may share the same `seek` value; they all appear together.
- There is no upper bound, but keep values within the intended runtime of the lab.

## Worked example

The finance ransomware intrusion, staged so the student first sees the encoded
PowerShell detection, then watches the C2 beacon, credential access, and mass file
encryption alerts arrive over the next few minutes.

```json
{
  "version": 1,
  "alerts": [
    {
      "id": "ALT-4821",
      "seek": 0,
      "title": "Encoded PowerShell command executed",
      "host": "win-ep-04",
      "source": "10.0.0.5",
      "rule": "T1059.001",
      "count": 1,
      "fields": { "parent_process": "WINWORD.EXE", "pid": 6624 }
    },
    {
      "id": "ALT-4822",
      "seek": 0,
      "title": "Office application spawned a command interpreter",
      "host": "win-ep-04",
      "source": "10.0.0.5",
      "rule": "T1566.001",
      "count": 1,
      "fields": { "parent_process": "WINWORD.EXE", "child_process": "powershell.exe" }
    },
    {
      "id": "ALT-4830",
      "seek": 45,
      "title": "Outbound connection to external host on port 4444",
      "host": "win-ep-04",
      "source": "10.0.0.5",
      "destination": "185.220.101.34",
      "rule": "T1071",
      "count": 12,
      "fields": { "dst_port": 4444, "proto": "tcp" }
    },
    {
      "id": "ALT-4844",
      "seek": 130,
      "title": "Access to LSASS process memory",
      "host": "win-ep-04",
      "source": "10.0.0.5",
      "rule": "T1003.001",
      "count": 1,
      "fields": { "target_process": "lsass.exe", "accessor_pid": 6624 }
    },
    {
      "id": "ALT-4861",
      "seek": 240,
      "title": "New scheduled task created",
      "host": "win-ep-04",
      "source": "10.0.0.5",
      "rule": "T1053.005",
      "count": 1,
      "fields": { "task_name": "\\Microsoft\\Windows\\SvcBatchSync", "action": "C:\\ProgramData\\svc.exe" }
    },
    {
      "id": "ALT-4899",
      "seek": 415,
      "title": "High-volume file modification with extension change",
      "host": "win-ep-04",
      "source": "10.0.0.5",
      "rule": "T1486",
      "count": 3184,
      "fields": { "new_extension": ".L0CK3D", "path": "C:\\Users\\j.mensah\\Documents" }
    }
  ]
}
```

Playthrough summary: at `t=0` the student sees the encoded-PowerShell and
Office-child-process alerts; at `t=45s` the port-4444 beacon to `185.220.101.34`;
at `t=130s` LSASS access; at `t=240s` the persistence task; and at `t=415s` the
mass-encryption event — the ransomware payload detonating.
