import { getCurrentUser } from "@/lib/auth";
import { isAuthorizedForScenario } from "@/lib/student";
import { getObjectStream } from "@/lib/storage";

/**
 * Serve a guide image/asset from object storage. Authorized viewers only:
 * instructors always; students whose cohort has the scenario. The markdown
 * renderer points relative image srcs at this route.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id, path } = await params;
  const allowed = user.role === "SUPER_ADMIN" || (await isAuthorizedForScenario(user.id, id));
  if (!allowed) return new Response("Forbidden", { status: 403 });

  // Guard against traversal; keys are stored under scenarios/<id>/guide/.
  const safe = path.filter((p) => p && p !== "." && p !== "..").join("/");
  if (!safe) return new Response("Not found", { status: 404 });

  try {
    const { stream, contentType } = await getObjectStream(`scenarios/${id}/guide/${safe}`);
    return new Response(stream, {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=300" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
