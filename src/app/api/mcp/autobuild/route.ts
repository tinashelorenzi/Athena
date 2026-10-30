import { mcpActor } from "@/lib/mcp/auth";
import { autoBuildBundle, bundleFromZip } from "@/lib/autobuild";
import { getBaseUrl } from "@/lib/url";

/**
 * POST /api/mcp/autobuild[?dry_run=1] — upload a bundle zip to the
 * auto-builder with an MCP key, for bundles too big to send through the MCP
 * `autobuild` tool as base64 (docs/mcp.md). The body is the zip itself
 * (`curl --data-binary @bundle.zip`) or a multipart form with a `file` field
 * (`curl -F file=@bundle.zip`). Answers with the same result as the tool.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 95 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const auth = await mcpActor(request);
  if ("response" in auth) return auth.response;

  let bytes: Uint8Array;
  if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return Response.json({ error: "Send the zip as the form field `file`." }, { status: 400 });
    bytes = new Uint8Array(await file.arrayBuffer());
  } else {
    bytes = new Uint8Array(await request.arrayBuffer());
  }
  if (!bytes.length) return Response.json({ error: "The body is empty: send the bundle zip." }, { status: 400 });
  if (bytes.length > MAX_BYTES) return Response.json({ error: "The zip is over 95 MB." }, { status: 413 });

  let entries;
  try {
    entries = bundleFromZip(bytes);
  } catch (e) {
    return Response.json({ error: `That isn't a readable zip: ${e instanceof Error ? e.message : e}` }, { status: 400 });
  }
  const dry = new URL(request.url).searchParams.get("dry_run");
  const res = await autoBuildBundle(entries, auth.actor.id, { dryRun: dry === "1" || dry === "true" });
  const base = await getBaseUrl();
  return Response.json(
    { ...res, adminUrl: res.scenarioId ? `${base}/admin/scenarios/${res.scenarioId}` : undefined },
    { status: res.error ? 422 : 200 },
  );
}
