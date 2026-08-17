/**
 * Clone an authored scenario from another Athena database (e.g. staging/production)
 * into the local DATABASE_URL.
 *
 *   SOURCE_DATABASE_URL="postgresql://..." npm run clone:scenario
 *
 * Lists scenarios from the source DB (with creator email), prompts for a selection,
 * and copies the scenario + endpoints into your local database. Artifact files in
 * object storage are not copied — re-upload artifacts in the editor if needed.
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function makeClient(url: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    /* env already set */
  }

  const sourceUrl = process.env.SOURCE_DATABASE_URL?.trim();
  const localUrl = process.env.DATABASE_URL?.trim();
  if (!sourceUrl) {
    console.error("\n  Set SOURCE_DATABASE_URL to the other instructor's Athena database.\n");
    console.error("  Example:");
    console.error('    SOURCE_DATABASE_URL="postgresql://..." npm run clone:scenario\n');
    process.exitCode = 1;
    return;
  }
  if (!localUrl) {
    console.error("\n  DATABASE_URL is not set in .env\n");
    process.exitCode = 1;
    return;
  }

  const source = makeClient(sourceUrl);
  const local = makeClient(localUrl);
  const { newRefToken } = await import("@/lib/scenarios");

  const rl = createInterface({ input, output });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (prompt: string) => {
    output.write(prompt);
    const next = await lines.next();
    if (next.done) throw new Error("Input ended.");
    return next.value.trim();
  };

  try {
    const scenarios = await source.scenario.findMany({
      orderBy: { title: "asc" },
      include: {
        endpoints: true,
        _count: { select: { endpoints: true } },
      },
    });

    const creatorIds = [...new Set(scenarios.map((s) => s.createdById))];
    const creators = await source.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true, email: true },
    });
    const creatorMap = new Map(creators.map((u) => [u.id, u]));

    console.log("\n  Athena — clone scenario from another database\n");

    if (scenarios.length === 0) {
      console.log("  No authored scenarios in the source database.\n");
      return;
    }

    scenarios.forEach((s, i) => {
      const author = creatorMap.get(s.createdById);
      const who = author ? `${author.name} <${author.email}>` : s.createdById;
      console.log(
        `  ${String(i + 1).padStart(2)}. ${s.title} [${s.type}] — ${s._count.endpoints} endpoint(s) — by ${who}`,
      );
    });
    console.log("");

    const answer = await ask("  Select a number to clone (or 'q' to quit): ");
    if (answer.toLowerCase() === "q") return;

    const idx = Number(answer) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= scenarios.length) {
      console.log("  ✗ Invalid selection.\n");
      process.exitCode = 1;
      return;
    }

    const src = scenarios[idx];
    const architect =
      (await local.user.findFirst({ where: { isArchitect: true }, orderBy: { createdAt: "asc" } })) ??
      (await local.user.findFirst({ where: { role: "SUPER_ADMIN" }, orderBy: { createdAt: "asc" } }));

    if (!architect) {
      console.log("  ✗ No local instructor account. Run `npm run create:superadmin` first.\n");
      process.exitCode = 1;
      return;
    }

    const cloneTitle = src.title.endsWith(" (Clone)") ? src.title : `${src.title} (Clone)`;

    const created = await local.scenario.create({
      data: {
        type: src.type,
        title: cloneTitle,
        description: src.description,
        exposure: src.exposure,
        hidden: src.hidden,
        realtime: src.realtime,
        brief: src.brief,
        objectives: src.objectives ?? undefined,
        flags: src.flags ?? undefined,
        reportRequired: src.reportRequired,
        reportPrompt: src.reportPrompt,
        logs: src.logs ?? undefined,
        alerts: src.alerts ?? undefined,
        guide: src.guide,
        guidePrompts: src.guidePrompts ?? undefined,
        guideAssets: src.guideAssets ?? undefined,
        refToken: newRefToken(),
        createdById: architect.id,
        endpoints: {
          create: src.endpoints.map((ep) => ({
            hostname: ep.hostname,
            edr: ep.edr ?? undefined,
            osquery: ep.osquery ?? undefined,
            artifactName: ep.artifactName,
            artifactSize: ep.artifactSize,
          })),
        },
      },
      include: { endpoints: true },
    });

    const bindAnswer = await ask(`  Bind to a cohort now? Enter cohort name or press Enter to skip: `);
    if (bindAnswer) {
      const cohort = await local.cohort.findUnique({ where: { name: bindAnswer } });
      if (!cohort) {
        console.log(`  ⚠ Cohort "${bindAnswer}" not found locally.\n`);
      } else {
        await local.cohortScenario.create({
          data: { cohortId: cohort.id, scenarioId: created.id, boundById: architect.id },
        });
        console.log(`  ✓ Bound to ${cohort.name}`);
      }
    }

    console.log(`\n  ✓ Cloned “${cloneTitle}”`);
    console.log(`    Local ID: ${created.id}`);
    console.log(`    Endpoints: ${created.endpoints.length}`);
    console.log(`\n    Edit: http://localhost:3000/admin/scenarios/${created.id}\n`);
    if (src.endpoints.some((e) => e.artifactKey)) {
      console.log("  ⚠ Source had artifact zips — re-upload them in the scenario editor if needed.\n");
    }
  } finally {
    rl.close();
    await source.$disconnect();
    await local.$disconnect();
  }
}

main().catch((err) => {
  console.error("\n  ✗ Clone failed:\n", err);
  process.exit(1);
});
