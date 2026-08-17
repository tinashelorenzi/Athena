import { requireApiKey } from "@/lib/api-auth";
import { bindScenariosToCohort } from "@/lib/athena-provision";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/cohorts/:id/bind-scenarios
 * Body: { refTokens?: string[], scenarioIds?: string[] }
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const key = await requireApiKey(request);
  if (!key) {
    return Response.json({ error: "Invalid or missing API key." }, { status: 401 });
  }

  const { id: cohortId } = await context.params;

  let body: { refTokens?: string[]; scenarioIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await bindScenariosToCohort({
    cohortId,
    refTokens: Array.isArray(body.refTokens) ? body.refTokens : [],
    scenarioIds: Array.isArray(body.scenarioIds) ? body.scenarioIds : [],
    boundById: key.createdById,
  });

  if (!result.ok) {
    const status = result.error === "Cohort not found." ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ ok: true, bound: result.bound, scenarioIds: result.scenarioIds });
}
