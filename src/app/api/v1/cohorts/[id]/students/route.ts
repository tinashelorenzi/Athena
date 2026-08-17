import { requireApiKey } from "@/lib/api-auth";
import { addStudentToCohort } from "@/lib/athena-provision";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/cohorts/:id/students
 * Body: { email, name?, zaioUserId?, studentNumber? }
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const key = await requireApiKey(request);
  if (!key) {
    return Response.json({ error: "Invalid or missing API key." }, { status: 401 });
  }

  const { id: cohortId } = await context.params;

  let body: {
    email?: string;
    name?: string;
    zaioUserId?: string;
    studentNumber?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await addStudentToCohort({
    cohortId,
    email: String(body.email ?? ""),
    name: body.name ?? null,
    zaioUserId: body.zaioUserId ?? null,
    studentNumber: body.studentNumber ?? null,
  });

  if (!result.ok) {
    const status = result.error === "Cohort not found." ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ ok: true, user: result.user });
}
