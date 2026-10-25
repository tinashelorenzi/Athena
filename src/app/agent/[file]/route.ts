import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { AGENT_DIST, agentManifest, installScriptResponse } from "@/lib/labs/agent-dist";

/**
 * Public agent downloads (docs/labs/spec.md section 6):
 *
 *   GET /agent/install.sh                    installer, with this Athena's URL baked in (also at /i)
 *   GET /agent/zaio_<ver>_{amd64,arm64}.deb  packages built by `npm run agent:build`
 *   GET /agent/zaio-linux-{amd64,arm64}      bare binaries (non-Debian systems)
 *   GET /agent/SHA256SUMS, manifest.json     checksums / version info
 *
 * Only files listed in the build's manifest are served.
 */

const TEXT = new Set(["SHA256SUMS", "manifest.json"]);

function contentType(file: string): string {
  if (file.endsWith(".deb")) return "application/vnd.debian.binary-package";
  if (file.endsWith(".json")) return "application/json";
  if (TEXT.has(file)) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await params;
  if (file === "install.sh") return installScriptResponse();

  const manifest = await agentManifest();
  const listed = manifest?.files.some((f) => f.name === file) ?? false;
  if (!listed && !TEXT.has(file)) {
    return new Response(manifest ? "Not found\n" : "No agent build — an administrator must run: npm run agent:build\n", { status: 404 });
  }
  const full = path.join(AGENT_DIST, path.basename(file));
  try {
    const [bytes, st] = await Promise.all([readFile(full), stat(full)]);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType(file),
        "Content-Length": String(st.size),
        "Cache-Control": "no-cache",
        ...(TEXT.has(file) ? {} : { "Content-Disposition": `attachment; filename="${file}"` }),
      },
    });
  } catch {
    return new Response(`${file} is not available — an administrator must run: npm run agent:build\n`, { status: 404 });
  }
}
