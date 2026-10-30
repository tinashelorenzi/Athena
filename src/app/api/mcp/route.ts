import { handleMcpPost } from "@/lib/mcp/server";
import { mcpActor } from "@/lib/mcp/auth";
import { TOOLS } from "@/lib/mcp/tools";
import { MCP_INFO } from "@/lib/mcp/info";

/**
 * POST /api/mcp — Athena's remote MCP server (Streamable HTTP, stateless,
 * JSON responses). Authenticated with a personal MCP key; tools act as the
 * key's architect. See docs/mcp.md.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const auth = await mcpActor(request);
  if ("response" in auth) return auth.response;
  return handleMcpPost(request, TOOLS, await MCP_INFO(), auth.actor);
}

/* No server-initiated stream: every tool answers in its POST. */
const notHere = () => new Response(null, { status: 405, headers: { Allow: "POST" } });
export const GET = notHere;
export const DELETE = notHere;
