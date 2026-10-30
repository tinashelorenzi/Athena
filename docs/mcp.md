# MCP server

Athena runs a remote **MCP server** (Model Context Protocol), so Claude, or any
other MCP client, can work in Athena on an instructor's behalf:

- **read** scenarios (SOC Dojos and Assessments, and labs), their data, labs'
  `lab.yaml`, scripts and files, cohorts, lab sessions and submissions;
- **grade**: work the grading queue, commit grades and feedback, release them,
  adjust lab scores and re-grade labs;
- **build**: upload a bundle to the [Auto-builder](./autobuild.md) as a zip, for
  SOC Dojos and Assessments and lab Dojos and Assessments.

Only **instructors with the architect permission** can use it. Each architect
makes their own MCP keys, and a key acts as that architect: everything done
through it is recorded as done by them.

## Setting it up

1. Sign in as an architect and open **Settings → MCP**. (Instructors without the
   architect permission don't see this tab. Grant it with
   `npm run promote:architect`.)
2. **Generate key** and name it after the client that will use it, for example
   "Claude Code on my laptop". Copy the key (`athmcp_…`). It's shown once.
3. Connect your client to `https://<your-athena>/api/mcp` with the key as a
   Bearer token.

**Claude Code** (the dialog fills in the key and URL for you):

```bash
claude mcp add --transport http athena https://<your-athena>/api/mcp --header "Authorization: Bearer athmcp_..."
```

Add `--scope user` to have it in every project. Run `/mcp` in Claude Code to
check it's connected.

**Claude Desktop** (`claude_desktop_config.json`), through
[mcp-remote](https://www.npmjs.com/package/mcp-remote), which needs Node.js:

```json
{
  "mcpServers": {
    "athena": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<your-athena>/api/mcp", "--header", "Authorization:${ATHENA_AUTH}"],
      "env": { "ATHENA_AUTH": "Bearer athmcp_..." }
    }
  }
}
```

**The Claude API** ([MCP connector](https://docs.claude.com/en/docs/agents-and-tools/mcp-connector)):
pass `{"type": "url", "url": "https://<your-athena>/api/mcp", "name": "athena",
"authorization_token": "athmcp_..."}` in `mcp_servers`.

Custom connectors on **claude.ai** (web and mobile) can't send a static key yet:
they need OAuth, which Athena's MCP server doesn't offer. Use Claude Code,
Claude Desktop or the API.

### Keys

- A key works only while its owner is an instructor (`SUPER_ADMIN`) **and** an
  architect. Remove either and their keys stop working at once.
- **Revoke** on the MCP tab cuts a key off at once. You can only see and revoke
  your own MCP keys.
- MCP keys and the integration keys under **API Access** (`ath_…`, for
  `/api/v1/*`) are separate: neither works on the other's endpoints.
- Only a SHA-256 hash of the key is stored. Treat it like your password: it can
  grade and change scenarios as you.

## Tools

| Tool | What it does |
|---|---|
| `whoami` | The account the key acts as, the Athena URL, and counts. |
| `list_scenarios` | Every scenario, filtered by `kind` (SOC, LAB), `type` (DOJO, ASSESSMENT) or a title `search`. |
| `get_scenario` | One scenario in full: brief, objectives, flags **with answers**, report settings, ATT&CK techniques, cohorts it's released to, a data summary. For a lab: slug, versions, parameters, checks, scripts, files. |
| `get_scenario_data` | Pages through a SOC scenario's `logs`, `alerts`, an endpoint's `edr` or `osquery`, or the `guide` (with prompt answers). `search` filters; `offset`/`limit` page (≤ 500). |
| `get_lab` | A lab version's `lab.yaml`, compiled checks and parameters, reference gate, assets, and scripts in full. By `scenario_id` or `slug`. |
| `list_cohorts`, `get_cohort` | Cohorts, their students and the scenarios released to them. |
| `list_lab_sessions` | A lab's sessions: student, status, score and override, flags, runs. |
| `get_lab_session` | One session with every check run's results (including instructor-only notes) and the audit trail. Evidence only with `include_evidence: true`. |
| `list_submissions` | The grading queue. `status`: `needs_grading` (default), `held`, `released`, `graded` or `all`; filter by `scenario_id`, `cohort_id` or `student` (id, email, name or student number). |
| `get_submission` | One submission: the report, each flag with the student's answer, the right answer and whether it matches, the suggested auto-grade. An uploaded `.docx` report comes as its text and a PDF as the document. |
| `grade_submission` | Commit a grade (0–100) and feedback. It locks the submission and stays **held** (hidden from the student) unless `release: true`. |
| `set_grades_released` | Release (or hide again) one or more graded submissions. |
| `set_submission_committed` | Lock a submission, or re-open it so the student can redo it. |
| `override_lab_score` | Adjust a finished lab session's score with a reason (audited); `null` clears it. |
| `preview_lab_regrade`, `apply_lab_regrade` | Re-run a lab's checks over stored evidence (`target`: `own` version or `latest`), previewing the score changes, then saving them. |
| `create_upload_url` | A one-off link, plus curl commands, to upload a bundle **zip file** to the auto-builder (below). |
| `get_upload_result` | What the last upload through such a link returned. |
| `autobuild` | Build from a bundle sent inside the tool call (below). |

Grading works as it does on the Grading page. The auto-grade (from flag points,
or a lab's final score) is a suggestion, and nothing reaches students until a
grade is released. The server tells the client to check with you before
releasing grades or applying a re-grade to many students.

## Building with the auto-builder

Claude takes the same bundles as **Scenarios → Auto-build**:

- **SOC Dojo or Assessment:** a folder with `scenario.json`, `brief.md`, logs,
  alerts, endpoints and a guide ([autobuild.md](./autobuild.md)). Each build
  creates a **new** scenario.
- **Lab Dojo or Assessment:** a folder with `scenario.json` (`"kind": "LAB"`),
  `brief.md`, `lab/lab.yaml`, `reference/`, `scripts/`
  ([labs/building-labs.md](./labs/building-labs.md)). A lab whose slug already
  exists gets a **new version**, as with a re-upload.

### Uploading a zip file

MCP tool calls carry JSON, not files, so Claude uploads a zip in two steps:

1. Claude calls `create_upload_url`. Athena returns a one-off upload link and
   two ready-to-run commands:

   ```bash
   curl -sS --data-binary "@bundle.zip" "https://<your-athena>/api/mcp/upload/up_…?dry_run=1"
   curl -sS --data-binary "@bundle.zip" "https://<your-athena>/api/mcp/upload/up_…"
   ```

2. Claude runs them from a shell: the dry run first, then the build. The output
   is the result (errors, the lab's check report, and `adminUrl` for the new
   scenario). `get_upload_result` shows it again.

The zip holds the bundle's folder at its root:

```
bundle.zip
└── my-lab/
    ├── scenario.json
    ├── brief.md
    └── lab/…
```

A zip of the folder's contents (`scenario.json` at the top) works too, and
`__MACOSX/` and `.DS_Store` are skipped. Up to 95 MB; behind nginx this needs
`client_max_body_size 100M;` ([deploy.md](./deploy.md)).

The link needs no other credentials: it acts as the architect whose key asked
for it. It lasts 30 minutes, and a build that saves something uses it up. Dry
runs and refused bundles don't use it up, so Claude can fix the bundle and
send it again. It returns HTTP 422 for a refused bundle and 410 once the link
is used up or expired.

This needs Claude to have a shell, as in Claude Code or Claude Desktop with a
terminal tool. Scripts that hold the MCP key can skip the link and POST the
zip to `/api/mcp/autobuild` with the key in the `Authorization` header (same
`?dry_run=1`, same answer).

### Sending the bundle in the tool call

`autobuild` takes the bundle inside the call, which suits a bundle Claude
writes itself:

- `files`: a list of `{ "path": "lab/lab.yaml", "content": "…" }`, with paths
  relative to the bundle folder and `"encoding": "base64"` for binary files;
- or `zip_base64`, for a small zip (a few hundred KB at most; use an upload
  link for anything real).

`dry_run: true` validates everything and saves nothing. For a lab it returns the
full check report (errors, warnings, reference gate), as `npm run lab:check`
does. A failed build comes back as an error with the same report.

## How it works

| Piece | Where |
|---|---|
| Keys: `ApiKey` rows with `kind = MCP` and the owner's `userId` (migration `20261030200000_mcp_keys`) | `prisma/schema.prisma`, `src/lib/apikeys.ts` (`verifyMcpKey`) |
| Settings tab, create/revoke | `src/components/screens/settings/McpSection.jsx`, `createMcpKey` / `revokeMcpKey` in `src/app/actions/apikeys.ts` |
| The endpoint | `src/app/api/mcp/route.ts`; protocol in `src/lib/mcp/server.ts`; auth in `src/lib/mcp/auth.ts`; what the server tells clients in `src/lib/mcp/info.ts` |
| Tools | `src/lib/mcp/tools.ts` |
| Zip uploads: upload links (`McpUpload`, migration `20261030220000_mcp_uploads`) and the endpoints | `src/lib/mcp/uploads.ts`, `src/app/api/mcp/upload/[token]/route.ts` (link), `src/app/api/mcp/autobuild/route.ts` (key) |
| Shared with the app | `src/lib/autobuild.ts` (the Auto-builder, also behind the page's action), `src/lib/grading.ts` (`gradeSubmissionAs`, …), `src/lib/labs/admin.ts` |

The server speaks MCP's Streamable HTTP transport statelessly. Each client
message is one `POST /api/mcp` with a JSON-RPC body, answered with plain JSON:
no sessions and no server-sent events, because every tool finishes within its
request. `GET` returns 405. It supports protocol versions 2024-11-05 through
2025-11-25. A missing or refused key gets HTTP 401.

To add a tool, add a `Tool` to `TOOLS` in `src/lib/mcp/tools.ts`. Give it a JSON
Schema for its input and a `run(args, actor)`, and throw `ToolError` for a
problem the model should see. Put shared logic in `src/lib` (as with grading)
rather than calling Server Actions, which check the browser session.
