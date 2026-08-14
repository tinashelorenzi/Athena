# Auto-builder

The **Auto-builder** creates an entire scenario — Dojo *or* Assessment — from a
single dropped folder. Instead of filling the form and adding endpoints one by
one, you arrange everything in a folder with a `scenario.json` manifest and drop
it at **Scenarios → Auto-build**. Everything is validated first; on success you
land in the new scenario's editor.

A complete, working example lives in
[`docs/examples/scenario-autobuild/`](./examples/scenario-autobuild/).

## Folder layout

```
my-scenario/
  scenario.json                 # REQUIRED — the manifest (below)
  brief.md                      # markdown briefing (referenced by the manifest)
  logs.json                     # logs bundle      → docs/logs-schema.md
  alerts.json                   # alerts bundle    → docs/alerts-schema.md
  guide/                        # optional learning guide → docs/guide-folder.md
    main.md
    images/…
  endpoints/
    win-ep-04/
      edr.json                  # EDR sample       → docs/edr-schema.md
      osquery.json              # OSQuery data     → docs/osquery-schema.md
      evidence.zip              # optional artifact
    lnx-jump-01/
      edr.json
```

All paths in the manifest are **relative to the folder root**. You can name and
nest files however you like — the manifest is the source of truth for what maps
where. Only `scenario.json` (with `title`) is strictly required; everything else
is optional.

## `scenario.json` manifest

```json
{
  "type": "DOJO",
  "title": "Ransomware in Finance",
  "description": "A finance workstation shows ransomware staging.",
  "exposure": "ROLLOUT",
  "hidden": false,
  "brief": "brief.md",
  "objectives": [
    "Identify the initial access vector",
    "Find the C2 server"
  ],
  "flags": [
    { "question": "What is the C2 IP?", "answer": "185.220.101.34", "points": 10 }
  ],
  "report": { "required": true, "prompt": "Summarize the intrusion timeline." },
  "guide": "guide/main.md",
  "logs": "logs.json",
  "alerts": "alerts.json",
  "endpoints": [
    {
      "hostname": "win-ep-04",
      "edr": "endpoints/win-ep-04/edr.json",
      "osquery": "endpoints/win-ep-04/osquery.json",
      "artifact": "endpoints/win-ep-04/evidence.zip"
    }
  ]
}
```

| Field         | Type                | Notes                                                        |
| ------------- | ------------------- | ------------------------------------------------------------ |
| `type`        | `DOJO`/`ASSESSMENT` | Defaults to `DOJO`.                                          |
| `title`       | string              | **Required.**                                               |
| `description` | string              |                                                              |
| `exposure`    | `ROLLOUT`/`PUBLIC`  | Defaults to `ROLLOUT` (hidden from students until bound).    |
| `hidden`      | boolean             | Dojo-only; reachable by reference link but unlisted.        |
| `realtime`    | boolean             | Real-time simulation — feed runs continuously, students can't pause. |
| `brief`       | string              | Path to a `.md` file, **or** inline markdown text.          |
| `objectives`  | string[]            | Guidance shown to students.                                 |
| `flags`       | object[]            | `{ question, answer, points }` — graded deliverable flags.  |
| `report`      | object              | `{ required, prompt }`.                                      |
| `guide`       | string              | Path to the guide `main.md` (see [guide-folder.md](./guide-folder.md)). Its images (siblings under the guide folder) upload automatically. |
| `logs`        | string              | Path to a logs bundle.                                       |
| `alerts`      | string              | Path to an alerts bundle.                                    |
| `endpoints`   | object[]            | Each `{ hostname, edr?, osquery?, artifact? }` with paths.  |

## Validation & storage

- Every referenced file is **read and validated before anything is written** — a
  malformed `logs.json` or a missing path fails the whole build with a clear
  message, and no scenario is created.
- Bundles are validated against the same schemas as the manual builder
  (`docs/{logs,alerts,edr,osquery}-schema.md`); guide `prompt` blocks are parsed
  and their answers kept server-side.
- If the bundle includes **guide images or endpoint artifacts**, object storage
  must be configured first (Settings → Storage). A text/JSON-only bundle doesn't
  need it.

## After building

You're redirected to the scenario editor, where everything is pre-filled — tweak
anything, grab the reference link, then bind it to a cohort to release it.
