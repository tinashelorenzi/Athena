import { assetName } from "./compile";
import { templateRefs } from "./template";
import type { CompiledLab } from "./types";

/**
 * Rules for lab scripts and files (docs/labs/scripts.md), kept free of the database so
 * the folder check (and `npm run lab:check`) can use them offline.
 */

export const SCRIPT_NAME = /^[a-z0-9][a-z0-9_-]{0,39}$/;
export const MAX_SCRIPT_BYTES = 256 * 1024;
/** Lab files go through the 100 MB Server Action body limit (next.config.ts), so stay under it. */
export const MAX_FILE_BYTES = 95 * 1024 * 1024;

/** A lab file's placeholder name: logs.json → logs_json (as for lab assets). */
export const labFileName = (filename: string) => assetName(filename);

/** Problems with a lab file's filename or size. */
export function validateLabFile(filename: string, size: number): string[] {
  const problems: string[] = [];
  if (!labFileName(filename)) problems.push(`"${filename}" needs letters or digits in its name`);
  else if (labFileName(filename).length > 60) problems.push(`"${filename}": keep file names under 60 characters`);
  if (/[\\/"\u0000-\u001f]/.test(filename)) problems.push(`"${filename}": no slashes, quotes or control characters in file names`);
  if (size === 0) problems.push(`"${filename}" is empty`);
  if (size > MAX_FILE_BYTES) problems.push(`"${filename}" is over ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB; have the script download it from elsewhere`);
  return problems;
}

/**
 * Problems with a script's name or text. `params` are the lab's, to check
 * {{param.x}}; `files` are the lab's file names, to check {{file.x}} (null skips both checks).
 */
export function validateScript(name: string, content: string, params: CompiledLab["params"] | null, files: string[] | null = null): string[] {
  const problems: string[] = [];
  if (!SCRIPT_NAME.test(name)) problems.push(`name "${name}" must be lowercase letters, digits, - or _ (up to 40), e.g. setup`);
  if (!content.trim()) problems.push("the script is empty");
  if (Buffer.byteLength(content, "utf8") > MAX_SCRIPT_BYTES) problems.push(`the script is over ${MAX_SCRIPT_BYTES / 1024} KB; ship big files as lab assets instead`);
  if (content.includes("\0")) problems.push("the script contains binary data; scripts must be text");
  for (const ref of templateRefs(content)) {
    if (ref.kind === "param") {
      if (params && !params[ref.name]) problems.push(`${ref.raw}: the lab has no parameter "${ref.name}"`);
    } else if (ref.kind === "file") {
      if (files && !files.includes(ref.name)) problems.push(`${ref.raw}: the lab has no file named like that (files: ${files.join(", ") || "none"})`);
    } else {
      problems.push(`${ref.raw}: scripts can only use {{param.<name>}} and {{file.<name>}} placeholders`);
    }
  }
  return problems;
}

/** File names a script downloads with {{file.x}}. */
export function scriptFileNames(content: string): string[] {
  return [...new Set(templateRefs(content ?? "").flatMap((r) => (r.kind === "file" ? [r.name] : [])))];
}

/** Script names a brief refers to with {{script.x}} / {{script.x.url}}. */
export function briefScriptNames(brief: string): string[] {
  return [...new Set(templateRefs(brief ?? "").flatMap((r) => (r.kind === "script" ? [r.name] : [])))];
}

/** Bash reads CRLF scripts badly ("$'\r': command not found"), so normalise line endings. */
export const normalizeScript = (content: string) => content.replace(/\r\n?/g, "\n");
