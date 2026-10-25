import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { labCsv } from "@/lib/labs/admin";

/**
 * GET /admin/labs/{labId}/export?scope=latest|all — CSV of a lab's sessions
 * (instructors only). `latest` (default): each student's latest finished
 * session; `all`: every session.
 */
export async function GET(request: Request, { params }: { params: Promise<{ labId: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") return new Response("Forbidden\n", { status: 403 });
  const { labId } = await params;
  const lab = await prisma.lab.findUnique({ where: { id: labId }, select: { slug: true } });
  if (!lab) return new Response("Not found\n", { status: 404 });
  const scope = new URL(request.url).searchParams.get("scope") === "all" ? "all" : "latest";
  const csv = await labCsv(labId, scope);
  const stamp = new Date().toISOString().slice(0, 10);
  // Leading BOM: Excel then reads UTF-8 names correctly.
  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${lab.slug}-${scope}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
