# Evidence artifacts

Beyond structured telemetry, a scenario endpoint may carry one uploaded **evidence
artifact** — a binary bundle a student downloads and analyzes with their own tools.

## What an artifact is

An artifact is a single **ZIP file** containing raw forensic evidence, for example:

- a memory dump (e.g. a Volatility-compatible `.raw`/`.mem` capture),
- a packet capture (`.pcap` / `.pcapng`),
- a disk image excerpt or a carved set of files,
- exported logs, a triage collection, or other case files.

The platform treats the ZIP as an opaque blob. It is **not** parsed, indexed, or
rendered — students download it exactly as uploaded and work it offline.

## Storage

Artifacts are stored in object storage (S3-compatible: AWS S3 or MinIO), configured
under **Settings → Storage**. On upload, the ZIP is placed in the configured bucket
and the endpoint record retains a reference (object key) to it. On download, the
platform serves the object back to the student verbatim.

## Attachment model

- Each artifact **attaches to a specific endpoint** by its `hostname`. It represents
  evidence collected from that one machine.
- An endpoint may have **at most one** artifact ZIP.
- The hostname must match a `ScenarioEndpoint.hostname` defined in the scenario, so
  the download appears on the correct machine in the student's console.

## Authoring guidance

- Package the evidence as a single `.zip`. If you have multiple files, zip them
  together rather than uploading several bundles.
- Name the file descriptively but neutrally, e.g. `win-ep-04-memory.zip` — avoid
  names that give away the analysis outcome (no `malware_dump.zip`).
- The archive contents are up to you; students receive them as-is with no
  platform-added markings or hints.

## Worked example

For the finance ransomware scenario, endpoint `win-ep-04` carries a single evidence
bundle — a memory capture taken during incident response:

- Endpoint: `win-ep-04`
- Artifact: `win-ep-04-memory.zip` (contains `win-ep-04.raw`, a physical memory dump)
- Stored at object key: `scenarios/<scenario-id>/endpoints/win-ep-04/win-ep-04-memory.zip`

The student downloads `win-ep-04-memory.zip`, extracts the dump, and analyzes it
(e.g. with Volatility) to recover the `svc.exe` process, the injected PowerShell, and
the C2 connection to `185.220.101.34` — none of which is labeled for them.
