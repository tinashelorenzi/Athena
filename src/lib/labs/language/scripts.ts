import { templateRefs } from "./template";
import type { CompiledLab } from "./types";

/**
 * Rules for lab scripts (docs/labs/scripts.md), kept free of the database so
 * the folder check (and `npm run lab:check`) can use them offline.
 */

export const SCRIPT_NAME = /^[a-z0-9][a-z0-9_-]{0,39}$/;
export const MAX_SCRIPT_BYTES = 256 * 1024;

/** Problems with a script's name or text; `params` are the lab's, to check {{param.x}}. */
export function validateScript(name: string, content: string, params: CompiledLab["params"] | null): string[] {
  const problems: string[] = [];
  if (!SCRIPT_NAME.test(name)) problems.push(`name "${name}" must be lowercase letters, digits, - or _ (up to 40), e.g. setup`);
  if (!content.trim()) problems.push("the script is empty");
  if (Buffer.byteLength(content, "utf8") > MAX_SCRIPT_BYTES) problems.push(`the script is over ${MAX_SCRIPT_BYTES / 1024} KB; ship big files as lab assets instead`);
  if (content.includes("\0")) problems.push("the script contains binary data; scripts must be text");
  for (const ref of templateRefs(content)) {
    if (ref.kind === "param") {
      if (params && !params[ref.name]) problems.push(`${ref.raw}: the lab has no parameter "${ref.name}"`);
    } else {
      problems.push(`${ref.raw}: scripts can only use {{param.<name>}} placeholders`);
    }
  }
  return problems;
}

/** Script names a brief refers to with {{script.x}} / {{script.x.url}}. */
export function briefScriptNames(brief: string): string[] {
  return [...new Set(templateRefs(brief ?? "").flatMap((r) => (r.kind === "script" ? [r.name] : [])))];
}

/** Bash reads CRLF scripts badly ("$'\r': command not found"), so normalise line endings. */
export const normalizeScript = (content: string) => content.replace(/\r\n?/g, "\n");
