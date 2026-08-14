import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getObjectStream } from "@/lib/storage";

/**
 * Stream a submission's uploaded report (docx/pdf) to an authorized viewer:
 * the student who owns it, or any instructor (SUPER_ADMIN). Auth is checked
 * against the DB before touching storage.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    select: { studentId: true, reportFileKey: true, reportFileName: true, reportFileType: true },
  });
  if (!submission || !submission.reportFileKey) return new Response("Not found", { status: 404 });

  const allowed = user.role === "SUPER_ADMIN" || submission.studentId === user.id;
  if (!allowed) return new Response("Forbidden", { status: 403 });

  try {
    const { stream, contentType } = await getObjectStream(submission.reportFileKey);
    const filename = (submission.reportFileName || "report").replace(/"/g, "");
    return new Response(stream, {
      headers: {
        "Content-Type": submission.reportFileType || contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return new Response(`Download failed: ${e instanceof Error ? e.message : "error"}`, { status: 502 });
  }
}
