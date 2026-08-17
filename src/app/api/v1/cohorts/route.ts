import { requireApiKey } from "@/lib/api-auth";
import { provisionCohortForBootcamp } from "@/lib/athena-provision";

/**
 * POST /api/v1/cohorts
 * Body: { name, zaioBootcampId }
 * Creates (or returns) an Athena cohort linked to a Zaio bootcamp.
 */
export async function POST(request: Request): Promise<Response> {
  const key = await requireApiKey(request);
  if (!key) {
    return Response.json({ error: "Invalid or missing API key." }, { status: 401 });
  }

  let body: { name?: string; zaioBootcampId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await provisionCohortForBootcamp({
    name: String(body.name ?? ""),
    zaioBootcampId: String(body.zaioBootcampId ?? ""),
    createdById: key.createdById,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({
    ok: true,
    cohort: result.cohort,
  });
}
