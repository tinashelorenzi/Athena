import { requireApiKey } from "@/lib/api-auth";
import { getCohortStudentAssessments } from "@/lib/athena-assessments";

type RouteContext = { params: Promise<{ id: string; zaioUserId: string }> };

/**
 * GET /api/v1/cohorts/:id/students/:zaioUserId/assessments
 * Released, graded ASSESSMENT scenarios bound to this cohort only.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const key = await requireApiKey(request);
  if (!key) {
    return Response.json({ error: "Invalid or missing API key." }, { status: 401 });
  }

  const { id: cohortId, zaioUserId } = await context.params;
  const result = await getCohortStudentAssessments(cohortId, decodeURIComponent(zaioUserId));

  if (!result.ok) {
    const status = result.error === "Cohort not found." ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ ok: true, assessments: result.assessments });
}
