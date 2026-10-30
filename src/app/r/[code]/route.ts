import { prisma } from "@/lib/db";
import { LabError, loadLabForUser } from "@/lib/labs/sessions";
import { getOrCreateLabParams } from "@/lib/labs/params-store";
import { renderTemplate } from "@/lib/labs/language/template";
import { findScriptLink } from "@/lib/labs/scripts";

/**
 * GET /r/{code} — a lab script, rendered with the link owner's parameters
 * (docs/labs/scripts.md). No sign-in: the brief shows each student their own
 * code, and machines fetch it with `curl -fsSL <link> | sudo bash`. The link
 * only works while the lab is visible to its owner.
 */

// Error bodies are shell too, so piping one to bash (curl without -f) fails loudly instead of running nothing.
const fail = (status: number, message: string) =>
  new Response(`echo ${JSON.stringify(`athena: ${message}`)} >&2\nexit 1\n`, {
    status,
    headers: { "Content-Type": "text/x-shellscript; charset=utf-8", "Cache-Control": "no-store" },
  });

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await params;
  const link = await findScriptLink(code);
  if (!link) return fail(404, "this script link doesn't exist; copy the command from your lab brief again");

  let loaded;
  try {
    loaded = await loadLabForUser(link.userId, { scenarioId: link.script.lab.scenarioId });
  } catch (e) {
    if (e instanceof LabError) return fail(e.status === 403 ? 403 : 404, "this lab isn't available to you any more");
    throw e;
  }
  const values = await getOrCreateLabParams(loaded.lab.id, link.userId, loaded.definition);
  await prisma.labScriptLink.update({ where: { id: link.id }, data: { fetchCount: { increment: 1 }, lastFetchedAt: new Date() } });

  return new Response(renderTemplate(link.script.content, { param: values }), {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Content-Disposition": `inline; filename="${link.script.name}.sh"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
