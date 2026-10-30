import { getBaseUrl } from "@/lib/url";
import type { ServerInfo } from "./server";

/** What the MCP server tells a client about itself when it connects (docs/mcp.md). */
export async function MCP_INFO(): Promise<ServerInfo> {
  const base = await getBaseUrl();
  return {
    name: "athena",
    title: "Athena",
    version: "1.0.0",
    instructions: `Athena is a cybersecurity training platform. You are connected as an instructor with the architect permission, and everything you change is recorded as done by them.

Scenarios come in two kinds:
- SOC: SIEM-style Dojos (practice) and Assessments (graded). Students investigate logs, alerts and endpoint data (EDR, OSQuery), answer flag questions and may write a report.
- LAB: practicals on the student's own Linux machines. lab.yaml defines checks that Athena's agent runs; a session's final check run is its score.
Scenarios are released to cohorts of students.

Grading:
- list_submissions shows the queue (needs_grading by default). get_submission has the full report and the flag answers; for a lab submission, also read get_lab_session.
- The auto-grade is a suggestion. grade_submission commits a 0–100 grade and feedback and keeps it HELD (hidden from the student) unless release is true. Release when the instructor says so, with set_grades_released.
- Lab scores: override_lab_score adjusts one finished session (with a reason); preview_lab_regrade, then apply_lab_regrade, re-runs checks over stored evidence.
- Confirm with the instructor before releasing grades or applying a re-grade to many students.

Building: autobuild takes a bundle (a zip whose root is the bundle's folder, or a list of files) and builds a SOC Dojo/Assessment or a lab Dojo/Assessment, as the Auto-builder page does. Run it with dry_run: true first. SOC bundles always create a new scenario; a lab bundle whose slug exists adds a new version. For a zip too big to send as base64 (more than a few MB), POST it with the same key instead:
  curl -fsS -H "Authorization: Bearer $ATHENA_MCP_KEY" --data-binary @bundle.zip "${base}/api/mcp/autobuild?dry_run=1"
(drop ?dry_run=1 to build). Bundle formats: ${base}/api/examples/autobuild-bundle has an example SOC bundle; the docs are docs/autobuild.md and docs/labs/building-labs.md in the Athena repository.

Links: a scenario's page is ${base}/admin/scenarios/<scenario id>; grading is ${base}/admin/grading.`,
  };
}
