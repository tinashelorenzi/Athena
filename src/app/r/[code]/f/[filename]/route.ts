import { prisma } from "@/lib/db";
import { resolveScriptLink, scriptLinkError as fail } from "@/lib/labs/scripts";
import { getObjectStream } from "@/lib/storage";

/**
 * GET /r/{code}/f/{filename} — a lab file, for scripts to download
 * ({{file.<name>}} in a script renders to this URL; docs/labs/scripts.md).
 * Authorised by the student's script link, with the same visibility rule:
 * any file of that script's lab, while the lab is visible to the link's owner.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string; filename: string }> }): Promise<Response> {
  const { code, filename: raw } = await params;
  const resolved = await resolveScriptLink(code);
  if (!resolved.ok) return fail(resolved.status, resolved.message);

  let filename = raw;
  try {
    filename = decodeURIComponent(raw);
  } catch {
    // Not percent-encoded after all: use it as it is.
  }
  const file = await prisma.labFile.findUnique({ where: { labId_filename: { labId: resolved.loaded.lab.id, filename } } });
  if (!file) return fail(404, "this lab has no file by that name");
  try {
    const { stream } = await getObjectStream(file.storageKey);
    return new Response(stream, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.size),
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return fail(502, "couldn't read that file from storage; tell your instructor");
  }
}
