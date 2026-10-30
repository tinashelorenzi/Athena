import { prisma } from "@/lib/db";
import { buildZip, findUpload, isDryRun, readZipBody } from "@/lib/mcp/uploads";

/**
 * POST /api/mcp/upload/{token}[?dry_run=1] — send a bundle zip to the
 * auto-builder through an upload link from the MCP `create_upload_url` tool
 * (docs/mcp.md). No other credentials: the link acts as the architect who
 * asked for it. Body: the zip (`curl --data-binary @bundle.zip`) or a
 * multipart `file` field. Answers with the build result.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const found = await findUpload((await params).token);
  if ("error" in found) return Response.json({ error: found.error }, { status: found.status });
  const { upload } = found;

  const body = await readZipBody(request);
  if ("error" in body) return Response.json({ error: body.error }, { status: body.status });

  const dryRun = isDryRun(request);
  const res = await buildZip(body.bytes, upload.userId, dryRun);
  const built = !dryRun && res.status === 200;
  await prisma.mcpUpload.update({
    where: { id: upload.id },
    data: { result: res.body as object, ...(built ? { usedAt: new Date(), scenarioId: (res.body as { scenarioId?: string }).scenarioId ?? null } : {}) },
  });
  return Response.json(res.body, { status: res.status });
}

const notHere = () => new Response("Upload the bundle zip with POST (curl --data-binary @bundle.zip <this url>).", { status: 405, headers: { Allow: "POST" } });
export const GET = notHere;
