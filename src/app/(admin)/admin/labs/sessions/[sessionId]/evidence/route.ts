import { getCurrentUser } from "@/lib/auth";
import { LabError } from "@/lib/labs/sessions";
import { sessionReferenceEvidence } from "@/lib/labs/reference";

/**
 * GET /admin/labs/sessions/{id}/evidence — the session's evidence as a
 * reference file (instructors only): drop it in a lab folder as
 * reference/good.evidence.json or broken.evidence.json.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") return new Response("Forbidden\n", { status: 403 });
  const { sessionId } = await params;
  try {
    const { ctx, evidence } = await sessionReferenceEvidence(sessionId);
    const name = `${ctx.session.labVersion.lab.slug}-${ctx.session.id}.evidence.json`;
    return new Response(JSON.stringify(evidence, null, 1) + "\n", {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof LabError) return new Response(`${e.message}\n`, { status: e.status });
    throw e;
  }
}
