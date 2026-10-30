import { readApiKeyFromRequest } from "@/lib/api-auth";
import { verifyMcpKey } from "@/lib/apikeys";
import type { McpActor } from "./server";

/**
 * The architect an MCP request acts as, from its `Authorization: Bearer
 * athmcp_…` (or `X-API-Key`) header, or a 401 response to send back.
 */
export async function mcpActor(request: Request): Promise<{ actor: McpActor } | { response: Response }> {
  const key = await verifyMcpKey(readApiKeyFromRequest(request));
  if (key) return { actor: { id: key.user.id, email: key.user.email, name: key.user.name } };
  return {
    response: Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32001,
          message:
            "Athena needs an MCP key from an instructor with the architect permission: send it as `Authorization: Bearer athmcp_…`. Generate one under Settings → MCP. A revoked key, or one whose owner lost the architect permission, is refused.",
        },
      },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="athena-mcp"' } },
    ),
  };
}
