import { mcpActor } from "@/lib/mcp/auth";
import { buildZip, isDryRun, readZipBody } from "@/lib/mcp/uploads";

/**
 * POST /api/mcp/autobuild[?dry_run=1] — upload a bundle zip to the
 * auto-builder with an MCP key in the Authorization header (docs/mcp.md).
 * Clients that don't hold the key use an upload link from the MCP
 * `create_upload_url` tool instead (/api/mcp/upload/<token>). The body is the
 * zip itself (`curl --data-binary @bundle.zip`) or a multipart form with a
 * `file` field. Answers with the same result as the `autobuild` tool.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const auth = await mcpActor(request);
  if ("response" in auth) return auth.response;

  const body = await readZipBody(request);
  if ("error" in body) return Response.json({ error: body.error }, { status: body.status });

  const res = await buildZip(body.bytes, auth.actor.id, isDryRun(request));
  return Response.json(res.body, { status: res.status });
}
