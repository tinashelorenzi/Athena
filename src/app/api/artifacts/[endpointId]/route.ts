import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAuthorizedForScenario } from "@/lib/student";
import { getObjectStream } from "@/lib/storage";

/**
 * Stream a scenario endpoint's evidence artifact to an authorized viewer.
 * Students must have the scenario released to their cohort; instructors always
 * pass. Auth is checked against the DB before touching storage.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ endpointId: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { endpointId } = await params;
  const endpoint = await prisma.scenarioEndpoint.findUnique({ where: { id: endpointId } });
  if (!endpoint || !endpoint.artifactKey) {
    return new Response("Not found", { status: 404 });
  }

  const allowed =
    user.role === "SUPER_ADMIN" || (await isAuthorizedForScenario(user.id, endpoint.scenarioId));
  if (!allowed) return new Response("Forbidden", { status: 403 });

  try {
    const { stream, contentType } = await getObjectStream(endpoint.artifactKey);
    const filename = (endpoint.artifactName || "artifact.zip").replace(/"/g, "");
    return new Response(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return new Response(`Download failed: ${e instanceof Error ? e.message : "error"}`, { status: 502 });
  }
}
