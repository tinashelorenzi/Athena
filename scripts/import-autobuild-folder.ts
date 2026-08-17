/**
 * Import a scenario from an auto-build folder (see docs/autobuild.md).
 *
 *   npm run import:scenario -- docs/examples/scenario-autobuild
 *   npm run import:scenario -- docs/examples/scenario-autobuild --bind "Cyber Sec - Jan 2027"
 *
 * Uses DATABASE_URL from `.env`. Assigns createdById to the first architect account,
 * or the first SUPER_ADMIN if none is marked architect.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function dirOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

async function walkFiles(root: string, base = root): Promise<{ rel: string; abs: string }[]> {
  const out: { rel: string; abs: string }[] = [];
  for (const name of await readdir(root)) {
    const abs = path.join(root, name);
    const st = await stat(abs);
    if (st.isDirectory()) out.push(...(await walkFiles(abs, base)));
    else out.push({ rel: path.relative(base, abs).replace(/\\/g, "/"), abs });
  }
  return out;
}

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    /* env already set */
  }

  const args = process.argv.slice(2);
  const bindIdx = args.indexOf("--bind");
  const bindCohort = bindIdx >= 0 ? args[bindIdx + 1]?.trim() : "";
  const folderArg = args.filter((a, i) => a !== "--bind" && (bindIdx < 0 || i !== bindIdx + 1))[0];

  if (!folderArg) {
    console.error("\n  Usage: npm run import:scenario -- <folder> [--bind \"Cohort name\"]\n");
    process.exitCode = 1;
    return;
  }

  const folder = path.resolve(folderArg);
  const {
    parseJson,
    validateLogs,
    validateAlerts,
    validateEdr,
    validateOsquery,
    normalizeObjectives,
    normalizeFlags,
  } = await import("@/lib/scenario-schemas");
  const { parseGuide } = await import("@/lib/guide");
  const { newRefToken } = await import("@/lib/scenarios");
  const { prisma } = await import("@/lib/db");

  const files = await walkFiles(folder);
  const map = new Map(files.map((f) => [f.rel, f.abs]));
  const readText = async (rel: string) => {
    const abs = map.get(rel);
    return abs ? readFile(abs, "utf8") : null;
  };

  const manifestText = await readText("scenario.json");
  if (!manifestText) {
    console.error("\n  ✗ Folder must contain scenario.json at its root.\n");
    process.exitCode = 1;
    return;
  }

  let m: Record<string, unknown>;
  try {
    m = JSON.parse(manifestText);
  } catch (e) {
    console.error(`\n  ✗ scenario.json is not valid JSON: ${e instanceof Error ? e.message : "parse error"}\n`);
    process.exitCode = 1;
    return;
  }

  const architect =
    (await prisma.user.findFirst({ where: { isArchitect: true }, orderBy: { createdAt: "asc" } })) ??
    (await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, orderBy: { createdAt: "asc" } }));

  if (!architect) {
    console.error("\n  ✗ No instructor account found. Run `npm run create:superadmin` first.\n");
    process.exitCode = 1;
    return;
  }

  const type = m.type === "ASSESSMENT" ? "ASSESSMENT" : "DOJO";
  const title = String(m.title ?? "").trim();
  if (!title) {
    console.error("\n  ✗ scenario.json: `title` is required.\n");
    process.exitCode = 1;
    return;
  }

  const description = String(m.description ?? "").trim();
  const exposure = m.exposure === "PUBLIC" ? "PUBLIC" : "ROLLOUT";
  const hidden = type === "DOJO" && Boolean(m.hidden);
  const realtime = Boolean(m.realtime);
  const reportRequired = Boolean((m.report as { required?: boolean })?.required);
  const reportPrompt = String((m.report as { prompt?: string })?.prompt ?? "").trim() || null;

  let brief = "";
  if (typeof m.brief === "string" && m.brief) {
    if (m.brief.endsWith(".md")) {
      const t = await readText(m.brief);
      if (t == null) {
        console.error(`\n  ✗ brief file "${m.brief}" not found.\n`);
        process.exitCode = 1;
        return;
      }
      brief = t;
    } else {
      brief = m.brief;
    }
  }

  const objectives = normalizeObjectives(((m.objectives as string[]) ?? []).map((t) => ({ text: String(t) })));
  const flags = normalizeFlags((m.flags as { question: string; answer: string; points?: number }[]) ?? []);

  const readBundle = async (
    ref: unknown,
    label: string,
    validate: (d: unknown) => { ok: boolean; error?: string; data?: unknown },
  ) => {
    if (typeof ref !== "string" || !ref) return { data: undefined as unknown };
    const t = await readText(ref);
    if (t == null) throw new Error(`${label} file "${ref}" not found.`);
    const parsed = parseJson(t);
    if (!parsed.ok) throw new Error(`${label} (${ref}): ${parsed.error}`);
    const v = validate(parsed.data);
    if (!v.ok) throw new Error(`${label} (${ref}): ${v.error}`);
    return { data: v.data };
  };

  try {
    const logsRes = await readBundle(m.logs, "logs", validateLogs);
    const alertsRes = await readBundle(m.alerts, "alerts", validateAlerts);

    let guide: string | null = null;
    let guidePrompts: unknown;
    let guideAssets: string[] = [];
    if (typeof m.guide === "string" && m.guide) {
      const gmd = await readText(m.guide);
      if (gmd == null) throw new Error(`guide file "${m.guide}" not found.`);
      const parsed = parseGuide(gmd);
      guide = parsed.guide;
      guidePrompts = parsed.prompts;
      const gdir = dirOf(m.guide);
      if (gdir) {
        const prefix = `${gdir}/`;
        guideAssets = files.filter((f) => f.rel.startsWith(prefix) && f.rel !== m.guide).map((f) => f.rel.slice(prefix.length));
      }
    }

    type EndpointPlan = { hostname: string; edr?: unknown; osquery?: unknown; artifactRel?: string };
    const endpointPlans: EndpointPlan[] = [];
    for (const raw of (m.endpoints as Record<string, string>[]) ?? []) {
      const hostname = String(raw.hostname ?? "").trim();
      if (!hostname) throw new Error("Each endpoint needs a `hostname`.");
      const plan: EndpointPlan = { hostname };
      if (raw.edr) {
        const r = await readBundle(raw.edr, `endpoint ${hostname} EDR`, validateEdr);
        plan.edr = r.data;
      }
      if (raw.osquery) {
        const r = await readBundle(raw.osquery, `endpoint ${hostname} OSQuery`, validateOsquery);
        plan.osquery = r.data;
      }
      if (raw.artifact) {
        if (!map.has(raw.artifact)) throw new Error(`endpoint ${hostname}: artifact "${raw.artifact}" not found.`);
        plan.artifactRel = raw.artifact;
      }
      endpointPlans.push(plan);
    }

    const scenario = await prisma.scenario.create({
      data: {
        type,
        title,
        description,
        exposure,
        hidden,
        realtime,
        brief,
        objectives: objectives.length ? objectives : undefined,
        flags: flags.length ? flags : undefined,
        reportRequired,
        reportPrompt,
        logs: (logsRes.data as object) ?? undefined,
        alerts: (alertsRes.data as object) ?? undefined,
        guide,
        guidePrompts: guidePrompts as object | undefined,
        guideAssets: guideAssets.length ? guideAssets : undefined,
        refToken: newRefToken(),
        createdById: architect.id,
      },
    });

    for (const ep of endpointPlans) {
      await prisma.scenarioEndpoint.create({
        data: {
          scenarioId: scenario.id,
          hostname: ep.hostname,
          edr: (ep.edr as object) ?? undefined,
          osquery: (ep.osquery as object) ?? undefined,
          artifactKey: ep.artifactRel ? `scenarios/${scenario.id}/${sanitize(ep.hostname)}/${sanitize(path.basename(ep.artifactRel))}` : undefined,
          artifactName: ep.artifactRel ? path.basename(ep.artifactRel) : undefined,
        },
      });
    }

    console.log(`\n  ✓ Imported “${title}”`);
    console.log(`    ID:       ${scenario.id}`);
    console.log(`    Author:   ${architect.name} <${architect.email}>`);
    console.log(`    Endpoints: ${endpointPlans.length}`);

    if (bindCohort) {
      const cohort = await prisma.cohort.findUnique({ where: { name: bindCohort } });
      if (!cohort) {
        console.log(`\n  ⚠ Cohort "${bindCohort}" not found — bind manually in Admin → Cohorts.\n`);
      } else {
        await prisma.cohortScenario.create({
          data: { cohortId: cohort.id, scenarioId: scenario.id, boundById: architect.id },
        });
        console.log(`    Bound to: ${cohort.name}`);
      }
    }

    console.log(`\n    Edit:  http://localhost:3000/admin/scenarios/${scenario.id}\n`);
  } catch (e) {
    console.error(`\n  ✗ Import failed: ${e instanceof Error ? e.message : "unknown error"}\n`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\n  ✗ Failed:\n", err);
  process.exit(1);
});
