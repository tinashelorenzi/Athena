import { prisma } from "@/lib/db";
import { getOrCreateLabParams } from "@/lib/labs/params-store";
import { renderTemplate } from "@/lib/labs/language/template";
import { resolveScriptLink, scriptLinkError as fail } from "@/lib/labs/scripts";
import { getBaseUrl } from "@/lib/url";

/**
 * GET /r/{code} — a lab script, rendered with the link owner's parameters
 * (docs/labs/scripts.md). No sign-in: the brief shows each student their own
 * code, and machines fetch it with `curl -fsSL <link> | sudo bash`. The link
 * only works while the lab is visible to its owner. {{file.<name>}} becomes a
 * download link through the same code (/r/{code}/f/{filename}).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await params;
  const resolved = await resolveScriptLink(code);
  if (!resolved.ok) return fail(resolved.status, resolved.message);
  const { link, loaded } = resolved;

  const [values, labFiles, base] = await Promise.all([
    getOrCreateLabParams(loaded.lab.id, link.userId, loaded.definition),
    prisma.labFile.findMany({ where: { labId: loaded.lab.id }, select: { name: true, filename: true } }),
    getBaseUrl(),
  ]);
  const file = Object.fromEntries(labFiles.map((f) => [f.name, `${base}/r/${link.id}/f/${encodeURIComponent(f.filename)}`]));
  await prisma.labScriptLink.update({ where: { id: link.id }, data: { fetchCount: { increment: 1 }, lastFetchedAt: new Date() } });

  return new Response(renderTemplate(link.script.content, { param: values, file }), {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Content-Disposition": `inline; filename="${link.script.name}.sh"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
