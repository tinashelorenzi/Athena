import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { getBaseUrl } from "@/lib/url";
import { renderTemplate } from "./language/template";
import { briefScriptNames } from "./language/scripts";
import { LabError, loadLabForUser } from "./sessions";

export { briefScriptNames, normalizeScript, scriptFileNames, validateScript, SCRIPT_NAME, MAX_SCRIPT_BYTES } from "./language/scripts";

/**
 * Lab scripts (docs/labs/scripts.md): shell scripts a brief hands to students
 * as a one-line curl command. {{script.<name>}} in the brief becomes
 * `curl -fsSL <base>/r/<code> | sudo bash`, where <code> is the student's own
 * short link to that script, so {{param.x}} inside the script is filled in with
 * their values when the machine fetches it (no sign-in needed from the VM).
 */

const CODE_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/l/I
const CODE_LENGTH = 10;

function newCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/**
 * The user's short link for each named script of a lab (created on first use
 * and kept, so a link a student copied keeps working). Unknown names are left
 * out, which leaves their placeholder visible in the brief.
 */
export async function scriptLinksFor(labId: string, userId: string, names: string[]): Promise<Record<string, string>> {
  if (!names.length) return {};
  const scripts = await prisma.labScript.findMany({
    where: { labId, name: { in: names } },
    select: { id: true, name: true, links: { where: { userId }, select: { id: true } } },
  });
  const base = await getBaseUrl();
  const out: Record<string, string> = {};
  for (const s of scripts) {
    let code: string | undefined = s.links[0]?.id;
    for (let attempt = 0; !code && attempt < 5; attempt++) {
      try {
        code = (await prisma.labScriptLink.create({ data: { id: newCode(), scriptId: s.id, userId }, select: { id: true } })).id;
      } catch {
        // A code collision, or a concurrent render made this user's link first: look again.
        code = (await prisma.labScriptLink.findUnique({ where: { scriptId_userId: { scriptId: s.id, userId } }, select: { id: true } }))?.id;
      }
    }
    if (code) out[s.name] = `${base}/r/${code}`;
  }
  return out;
}

/** A brief with the user's own values and script links filled in. */
export async function renderBriefFor(brief: string, labId: string, userId: string, params: Record<string, string | number> | null): Promise<string> {
  const script = await scriptLinksFor(labId, userId, briefScriptNames(brief));
  return renderTemplate(brief ?? "", { param: params ?? undefined, script });
}

/** Look up a short link (for /r/<code>). */
export async function findScriptLink(code: string) {
  if (!/^[A-Za-z0-9]{6,32}$/.test(code)) return null;
  return prisma.labScriptLink.findUnique({
    where: { id: code },
    include: { script: { include: { lab: { select: { id: true, scenarioId: true, slug: true } } } } },
  });
}

/**
 * A short link plus the lab as its owner may see it, or why it can't be used:
 * links follow the lab's visibility (loadLabForUser), like the lab page.
 */
export async function resolveScriptLink(code: string) {
  const link = await findScriptLink(code);
  if (!link) return { ok: false as const, status: 404, message: "this script link doesn't exist; copy the command from your lab brief again" };
  try {
    const loaded = await loadLabForUser(link.userId, { scenarioId: link.script.lab.scenarioId });
    return { ok: true as const, link, loaded };
  } catch (e) {
    if (e instanceof LabError) return { ok: false as const, status: e.status === 403 ? 403 : 404, message: "this lab isn't available to you any more" };
    throw e;
  }
}

/**
 * An error from /r/<code> (or a file under it). The body is shell too, so
 * piping it to bash (curl without -f) fails loudly instead of running nothing.
 */
export const scriptLinkError = (status: number, message: string) =>
  new Response(`echo ${JSON.stringify(`athena: ${message}`)} >&2\nexit 1\n`, {
    status,
    headers: { "Content-Type": "text/x-shellscript; charset=utf-8", "Cache-Control": "no-store" },
  });
