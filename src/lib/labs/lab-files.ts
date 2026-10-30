import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { deleteObject, putObject } from "@/lib/storage";
import { labFileName, validateLabFile } from "./language/scripts";

/**
 * Lab files (docs/labs/scripts.md): files a lab's scripts download with
 * {{file.<name>}}, e.g. a JSON log dump to ingest. Stored in object storage
 * under labs/<labId>/files/, recorded as LabFile rows on the lab (not a
 * version), and served through the student's script link: /r/<code>/f/<filename>.
 */

const CONTENT_TYPES: Record<string, string> = {
  json: "application/json", ndjson: "application/x-ndjson", jsonl: "application/x-ndjson",
  txt: "text/plain", log: "text/plain", csv: "text/csv", yaml: "text/yaml", yml: "text/yaml", conf: "text/plain",
  sh: "text/x-shellscript", py: "text/x-python",
  gz: "application/gzip", tgz: "application/gzip", zip: "application/zip", tar: "application/x-tar",
  pcap: "application/vnd.tcpdump.pcap", evtx: "application/octet-stream",
};
export const contentTypeFor = (filename: string) => CONTENT_TYPES[filename.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

const storageKey = (labId: string, sha256: string, filename: string) =>
  `labs/${labId}/files/${sha256.slice(0, 16)}-${filename.replace(/[^A-Za-z0-9._-]/g, "_")}`;

/** The names ({{file.<name>}}) of a lab's files on Athena, for checkLabFolder's `existingFiles`. */
export async function labFileNames(slug: string): Promise<string[]> {
  const rows = await prisma.labFile.findMany({ where: { lab: { slug } }, select: { name: true }, orderBy: { name: "asc" } });
  return rows.map((r) => r.name);
}

export type StoredLabFile = { name: string; filename: string; size: number; sha256: string; contentType: string; storageKey: string };

/**
 * Upload a file's bytes unless the lab already has this exact content under
 * that name. Returns the row data to upsert and, when it replaces an object,
 * the old key to delete once the row points at the new one.
 */
export async function putLabFile(labId: string, filename: string, bytes: Uint8Array): Promise<{ row: StoredLabFile; replaces: string | null }> {
  const name = labFileName(filename);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = await prisma.labFile.findUnique({ where: { labId_name: { labId, name } } });
  const contentType = contentTypeFor(filename);
  if (existing && existing.sha256 === sha256) {
    return { row: { name, filename, size: bytes.length, sha256, contentType, storageKey: existing.storageKey }, replaces: null };
  }
  const key = storageKey(labId, sha256, filename);
  await putObject(key, Buffer.from(bytes), contentType);
  return { row: { name, filename, size: bytes.length, sha256, contentType, storageKey: key }, replaces: existing && existing.storageKey !== key ? existing.storageKey : null };
}

export const upsertLabFile = (labId: string, row: StoredLabFile, byUserId: string) =>
  prisma.labFile.upsert({
    where: { labId_name: { labId, name: row.name } },
    update: { ...row, updatedById: byUserId },
    create: { labId, ...row, updatedById: byUserId },
  });

/** Add or replace one file from the lab page. */
export async function saveLabFile(labId: string, filename: string, bytes: Uint8Array, byUserId: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const problems = validateLabFile(filename, bytes.length);
  if (problems.length) return { ok: false, error: problems.join("; ") };
  const { row, replaces } = await putLabFile(labId, filename, bytes);
  await upsertLabFile(labId, row, byUserId);
  if (replaces) await deleteObject(replaces);
  return { ok: true, name: row.name };
}

/** Delete a file and its stored bytes. */
export async function removeLabFile(labId: string, name: string): Promise<void> {
  const row = await prisma.labFile.findUnique({ where: { labId_name: { labId, name } } });
  if (!row) return;
  await prisma.labFile.delete({ where: { id: row.id } });
  await deleteObject(row.storageKey);
}
