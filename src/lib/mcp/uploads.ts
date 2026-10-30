import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getBaseUrl } from "@/lib/url";
import { autoBuildBundle, bundleFromZip } from "@/lib/autobuild";

/**
 * Bundle zips for the auto-builder over HTTP (docs/mcp.md). An MCP client
 * can't attach a file to a tool call, so it asks for an upload link
 * (`create_upload_url`) and sends the zip with curl. The link carries a
 * random token (only its hash is stored), acts as the architect who asked
 * for it, and lasts UPLOAD_TTL_MINUTES. A build that saves something uses it
 * up; dry runs and refused bundles don't, so the client can fix and resend.
 */

export const UPLOAD_TTL_MINUTES = 30;
export const MAX_BUNDLE_BYTES = 95 * 1024 * 1024;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createUpload(userId: string) {
  const token = `up_${randomBytes(24).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + UPLOAD_TTL_MINUTES * 60_000);
  const row = await prisma.mcpUpload.create({ data: { tokenHash: hash(token), userId, expiresAt }, select: { id: true } });
  return { id: row.id, url: `${await getBaseUrl()}/api/mcp/upload/${token}`, expiresAt };
}

/** The upload a token belongs to, if it can still be used, with the user it acts as. */
export async function findUpload(token: string) {
  if (!/^up_[A-Za-z0-9_-]{20,64}$/.test(token)) return { error: "This upload link doesn't exist.", status: 404 } as const;
  const up = await prisma.mcpUpload.findUnique({ where: { tokenHash: hash(token) }, include: { user: { select: { id: true, role: true, isArchitect: true } } } });
  if (!up) return { error: "This upload link doesn't exist.", status: 404 } as const;
  if (up.usedAt) return { error: "This upload link was already used for a build. Ask for a new one (create_upload_url).", status: 410 } as const;
  if (up.expiresAt.getTime() < Date.now()) return { error: "This upload link has expired. Ask for a new one (create_upload_url).", status: 410 } as const;
  if (up.user.role !== "SUPER_ADMIN" || !up.user.isArchitect) return { error: "The architect this link belongs to can't build any more.", status: 403 } as const;
  return { upload: up } as const;
}

/** The zip in a request: the raw body, or a multipart form's `file` field. */
export async function readZipBody(request: Request): Promise<{ bytes: Uint8Array } | { error: string; status: number }> {
  let bytes: Uint8Array;
  if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return { error: "Send the zip as the form field `file`.", status: 400 };
    bytes = new Uint8Array(await file.arrayBuffer());
  } else {
    bytes = new Uint8Array(await request.arrayBuffer());
  }
  if (!bytes.length) return { error: "The body is empty: send the bundle zip (curl --data-binary @bundle.zip).", status: 400 };
  if (bytes.length > MAX_BUNDLE_BYTES) return { error: "The zip is over 95 MB.", status: 413 };
  return { bytes };
}

/** Build (or dry-run) a bundle zip as `actorId`; the JSON answer and its HTTP status. */
export async function buildZip(bytes: Uint8Array, actorId: string, dryRun: boolean) {
  let entries;
  try {
    entries = bundleFromZip(bytes);
  } catch (e) {
    return { status: 400, body: { error: `That isn't a readable zip: ${e instanceof Error ? e.message : e}` } };
  }
  const res = await autoBuildBundle(entries, actorId, { dryRun });
  const base = await getBaseUrl();
  return {
    status: res.error ? 422 : 200,
    body: { ...res, adminUrl: res.scenarioId ? `${base}/admin/scenarios/${res.scenarioId}` : undefined },
  };
}

export const isDryRun = (request: Request) => {
  const v = new URL(request.url).searchParams.get("dry_run");
  return v === "1" || v === "true";
};
