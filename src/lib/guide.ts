/**
 * Teaching-guide parsing. A guide is authored as markdown (`main.md`) that may
 * contain fenced ```prompt blocks — CTF-style questions. On save we extract the
 * prompts (answers kept server-only) and replace each block with a
 * `[[prompt:<id>]]` sentinel the student renderer turns into an interactive card.
 *
 * Prompt block syntax:
 *   ```prompt
 *   question: What is the C2 IP address?
 *   answer: 185.220.101.34
 *   hint: Look at the outbound connections.
 *   points: 10
 *   ```
 */
export type GuidePrompt = { id: string; question: string; answer: string; hint: string; points: number };
export type PublicPrompt = { id: string; question: string; hint: string; points: number };

const PROMPT_RE = /```prompt[ \t]*\r?\n([\s\S]*?)```/g;

export function parseGuide(markdown: string): { guide: string; prompts: GuidePrompt[] } {
  const prompts: GuidePrompt[] = [];
  let idx = 0;

  const guide = String(markdown ?? "").replace(PROMPT_RE, (_m, body: string) => {
    const fields: Record<string, string> = {};
    for (const line of body.split(/\r?\n/)) {
      const m = line.match(/^\s*(question|answer|hint|points)\s*:\s*(.*)$/i);
      if (m) fields[m[1].toLowerCase()] = m[2].trim();
    }
    if (!fields.question || !fields.answer) return ""; // drop malformed blocks
    idx += 1;
    const id = `p${idx}`;
    prompts.push({
      id,
      question: fields.question,
      answer: fields.answer,
      hint: fields.hint ?? "",
      points: Number(fields.points) || 0,
    });
    return `\n\n[[prompt:${id}]]\n\n`;
  });

  return { guide, prompts };
}

/** Strip answers before sending prompts to a student. */
export function publicPrompts(prompts: unknown): PublicPrompt[] {
  if (!Array.isArray(prompts)) return [];
  return prompts.map((p, i) => ({
    id: String((p as GuidePrompt)?.id ?? `p${i + 1}`),
    question: String((p as GuidePrompt)?.question ?? ""),
    hint: String((p as GuidePrompt)?.hint ?? ""),
    points: Number((p as GuidePrompt)?.points ?? 0),
  }));
}

export function normalizeAnswer(s: string): string {
  return String(s ?? "").trim().toLowerCase();
}

/**
 * Normalize an uploaded path to be relative to the dropped folder root: drop the
 * leading folder segment (webkitRelativePath is `<folder>/main.md`). Also guards
 * against path traversal.
 */
export function guideRelPath(path: string): string {
  const parts = String(path)
    .replace(/\\/g, "/")
    .split("/")
    .filter((p) => p && p !== "." && p !== "..");
  return parts.length > 1 ? parts.slice(1).join("/") : parts.join("/");
}
