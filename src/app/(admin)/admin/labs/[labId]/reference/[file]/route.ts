import { getCurrentUser } from "@/lib/auth";
import { versionReferenceFile } from "@/lib/labs/reference";

/**
 * GET /admin/labs/{labId}/reference/{good.evidence.json|broken.evidence.json|broken.expect.json}?v=N
 * — a version's stored reference file (instructors only; default: the newest
 * version), named as it belongs in the lab folder's reference/ directory.
 */
export async function GET(request: Request, { params }: { params: Promise<{ labId: string; file: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") return new Response("Forbidden\n", { status: 403 });
  const { labId, file } = await params;
  const v = Number(new URL(request.url).searchParams.get("v")) || undefined;
  const found = await versionReferenceFile(labId, file, v);
  if (!found) return new Response("Not found\n", { status: 404 });
  return new Response(JSON.stringify(found.body, null, 1) + "\n", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${found.name}"`,
      "Cache-Control": "no-store",
    },
  });
}
