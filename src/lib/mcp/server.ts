/**
 * A small, stateless MCP server over Streamable HTTP (docs/mcp.md): every
 * request is one POST carrying a JSON-RPC message (or a batch), answered with
 * plain JSON. No sessions or server-sent events are needed because every tool
 * answers in one go. Tools live in ./tools.ts.
 */

export type McpActor = { id: string; email: string; name: string };

/** A tool's MCP content blocks, for results that aren't plain JSON (e.g. a PDF). */
export class ToolContent {
  constructor(readonly content: Record<string, unknown>[]) {}
}

/** A problem to report back to the model as a failed tool call (not a protocol error). */
export class ToolError extends Error {}

export type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  run: (args: Record<string, unknown>, actor: McpActor) => Promise<unknown>;
};

const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

type RpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
type RpcReply = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

const reply = (id: RpcReply["id"], result: unknown): RpcReply => ({ jsonrpc: "2.0", id, result });
const fail = (id: RpcReply["id"], code: number, message: string): RpcReply => ({ jsonrpc: "2.0", id, error: { code, message } });

export type ServerInfo = { name: string; title: string; version: string; instructions: string };

async function callTool(tools: Map<string, Tool>, params: Record<string, unknown>, actor: McpActor) {
  const tool = tools.get(String(params.name ?? ""));
  if (!tool) return null;
  const args = params.arguments && typeof params.arguments === "object" ? (params.arguments as Record<string, unknown>) : {};
  try {
    const out = await tool.run(args, actor);
    if (out instanceof ToolContent) return { content: out.content };
    return { content: [{ type: "text", text: JSON.stringify(out, null, 1) }], structuredContent: out && typeof out === "object" && !Array.isArray(out) ? out : undefined };
  } catch (e) {
    if (e instanceof ToolError) return { content: [{ type: "text", text: e.message }], isError: true };
    console.error(`[mcp] ${tool.name} failed`, e);
    return { content: [{ type: "text", text: `Athena hit an internal error running ${tool.name}: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }
}

async function handleOne(msg: RpcMessage, tools: Map<string, Tool>, info: ServerInfo, actor: McpActor): Promise<RpcReply | null> {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return msg && typeof msg === "object" && "id" in msg ? fail(msg.id ?? null, -32600, "Invalid JSON-RPC request.") : fail(null, -32600, "Invalid JSON-RPC request.");
  }
  const isNotification = !("id" in msg) || msg.id === undefined;
  if (isNotification) return null; // notifications/initialized, notifications/cancelled, …
  const id = msg.id ?? null;
  const params = msg.params ?? {};

  switch (msg.method) {
    case "initialize": {
      const asked = String(params.protocolVersion ?? "");
      return reply(id, {
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: info.name, title: info.title, version: info.version },
        instructions: info.instructions,
      });
    }
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, {
        tools: [...tools.values()].map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })),
      });
    case "tools/call": {
      const res = await callTool(tools, params, actor);
      return res ? reply(id, res) : fail(id, -32602, `Unknown tool: ${String(params.name)}`);
    }
    case "resources/list":
      return reply(id, { resources: [] });
    case "prompts/list":
      return reply(id, { prompts: [] });
    default:
      return fail(id, -32601, `Method not found: ${msg.method}`);
  }
}

/** Answer one Streamable HTTP POST body. */
export async function handleMcpPost(request: Request, tools: Tool[], info: ServerInfo, actor: McpActor): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(fail(null, -32700, "Parse error: the body must be JSON-RPC."), { status: 400 });
  }
  const map = new Map(tools.map((t) => [t.name, t]));
  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map((m) => handleOne(m as RpcMessage, map, info, actor)))).filter((r): r is RpcReply => r != null);
    return replies.length ? Response.json(replies) : new Response(null, { status: 202 });
  }
  const one = await handleOne(body as RpcMessage, map, info, actor);
  return one ? Response.json(one) : new Response(null, { status: 202 });
}

/* ── argument helpers for tools ─────────────────────────────────────────────── */

export function argStr(args: Record<string, unknown>, key: string, required: true): string;
export function argStr(args: Record<string, unknown>, key: string, required?: false): string | undefined;
export function argStr(args: Record<string, unknown>, key: string, required = false): string | undefined {
  const v = args[key];
  if (v == null || v === "") {
    if (required) throw new ToolError(`\`${key}\` is required.`);
    return undefined;
  }
  if (typeof v !== "string" && typeof v !== "number") throw new ToolError(`\`${key}\` must be a string.`);
  return String(v).trim();
}

export function argNum(args: Record<string, unknown>, key: string, fallback?: number): number | undefined {
  const v = args[key];
  if (v == null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ToolError(`\`${key}\` must be a number.`);
  return n;
}

export function argBool(args: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = args[key];
  if (v == null) return fallback;
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  throw new ToolError(`\`${key}\` must be true or false.`);
}

export function argEnum<T extends string>(args: Record<string, unknown>, key: string, values: readonly T[], fallback?: T): T | undefined {
  const v = argStr(args, key);
  if (v == null) return fallback;
  const hit = values.find((x) => x.toLowerCase() === v.toLowerCase());
  if (!hit) throw new ToolError(`\`${key}\` must be one of: ${values.join(", ")}.`);
  return hit;
}

export function argStrList(args: Record<string, unknown>, key: string): string[] | undefined {
  const v = args[key];
  if (v == null) return undefined;
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new ToolError(`\`${key}\` must be a list of strings.`);
  return v as string[];
}

/** A page of a list, with how much there is. */
export function page<T>(items: T[], offset: number, limit: number) {
  const o = Math.max(0, Math.floor(offset));
  const l = Math.max(1, Math.min(500, Math.floor(limit)));
  return { total: items.length, offset: o, limit: l, items: items.slice(o, o + l), more: o + l < items.length };
}
