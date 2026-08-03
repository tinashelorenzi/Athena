# Athena Scenario Data Formats

Reference documentation for the JSON bundles instructors upload when authoring an
Athena SOC-lab scenario. Each bundle is validated on upload and then replayed to
students inside the investigation console.

## Design principle: students see raw data

Every example in these documents is deliberately **neutral and raw**. Students in
the Athena lab are meant to reach their own conclusions from unlabeled telemetry,
exactly as a real analyst would. Author data must therefore **never** contain
analyst judgement fields such as `suspicious`, `verdict`, `malicious`, `flag`,
`severity`, `confidence`, or free-text hints that pre-empt the investigation. The
platform renders your data as-is, with no coloring, scoring, or triage markings.

Keep those markings in the private answer key / grading rubric (out of scope for
these schemas), not in the student-facing bundles.

## Bundle index

| Model field | Bundle | Document | Purpose |
|---|---|---|---|
| `Scenario.logs` | Logs | [logs-schema.md](./logs-schema.md) | Time-ordered raw log lines across hosts and sources. |
| `Scenario.alerts` | Alerts | [alerts-schema.md](./alerts-schema.md) | Detections that surface into the student's queue over time via a `seek` offset. |
| `ScenarioEndpoint.edr` | EDR sample | [edr-schema.md](./edr-schema.md) | Per-endpoint live state: process tree, connections, browser and shell history. |
| `ScenarioEndpoint.osquery` | OSQuery data | [osquery-schema.md](./osquery-schema.md) | Per-endpoint osquery table snapshots (SQL-table data model). |
| Object storage | Evidence artifacts | [artifacts.md](./artifacts.md) | One uploaded evidence ZIP per endpoint (memory dump, pcap, disk excerpt). |

## Shared conventions

- **Encoding:** UTF-8 JSON. Every bundle begins with an integer `"version": 1`.
- **Timestamps:** ISO 8601 in UTC with a trailing `Z` (e.g. `2026-07-01T14:32:07.412Z`).
  Millisecond precision is accepted but not required.
- **Hostnames:** must match the `hostname` of a `ScenarioEndpoint` defined in the
  same scenario so telemetry links back to the right machine.
- **`fields` objects:** several schemas allow an optional free-form `fields` map of
  arbitrary key/value pairs for source-specific data. Keep keys neutral and factual.

## Worked-example theme

To keep the examples coherent, every document below draws from the same fictional
intrusion — a ransomware actor gaining a foothold in a finance department:

- Compromised endpoint: **`win-ep-04`** (a finance analyst workstation, `10.0.0.5`)
- External C2 address: **`185.220.101.34`**
- Abused service account: **`svc-batch`**

These are illustrative values only; substitute your own when authoring.
