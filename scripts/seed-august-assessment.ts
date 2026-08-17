/**
 * Create a sample ASSESSMENT for the Cyber Security - August 2026 cohort.
 *
 *   npm run seed:august-assessment
 *
 * Clones SOC content from the existing Ransomware example (logs/alerts/flags),
 * binds to the August cohort, and seeds a released grade for qcto-sp-test@zaio.test
 * so the Zaio transcript integration can be verified.
 */

const AUGUST_COHORT_NAME = "Cyber Security - August 2026";
const SOURCE_SCENARIO_ID = "cmsvzxc8w0000trrmxbgw2k4z";
const SAMPLE_STUDENT_EMAIL = "qcto-sp-test@zaio.test";
const ASSESSMENT_TITLE = "Ransomware Incident Report (Assessment)";

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    /* env already set */
  }

  const { newRefToken } = await import("@/lib/scenarios");
  const { prisma } = await import("@/lib/db");

  const architect =
    (await prisma.user.findFirst({ where: { isArchitect: true }, orderBy: { createdAt: "asc" } })) ??
    (await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, orderBy: { createdAt: "asc" } }));

  if (!architect) {
    console.error("\n  ✗ No instructor account. Run `npm run create:superadmin` first.\n");
    process.exitCode = 1;
    return;
  }

  const cohort = await prisma.cohort.findUnique({ where: { name: AUGUST_COHORT_NAME } });
  if (!cohort) {
    console.error(`\n  ✗ Cohort not found: "${AUGUST_COHORT_NAME}"\n`);
    process.exitCode = 1;
    return;
  }

  const source = await prisma.scenario.findUnique({
    where: { id: SOURCE_SCENARIO_ID },
    include: { endpoints: true },
  });
  if (!source) {
    console.error(`\n  ✗ Source scenario not found: ${SOURCE_SCENARIO_ID}\n`);
    process.exitCode = 1;
    return;
  }

  let scenario = await prisma.scenario.findFirst({
    where: { title: ASSESSMENT_TITLE, type: "ASSESSMENT" },
    include: { endpoints: true },
  });

  if (!scenario) {
    scenario = await prisma.scenario.create({
      data: {
        type: "ASSESSMENT",
        title: ASSESSMENT_TITLE,
        description:
          "Graded assessment: investigate the ransomware staging on win-ep-04, submit flag answers and an incident report.",
        exposure: source.exposure,
        hidden: false,
        realtime: source.realtime,
        brief: source.brief,
        objectives: source.objectives ?? undefined,
        flags: source.flags ?? undefined,
        reportRequired: true,
        reportPrompt:
          source.reportPrompt ??
          "Write an incident report covering initial access, C2 communication, and recommended containment steps.",
        logs: source.logs ?? undefined,
        alerts: source.alerts ?? undefined,
        guide: source.guide,
        guidePrompts: source.guidePrompts ?? undefined,
        guideAssets: source.guideAssets ?? undefined,
        refToken: newRefToken(),
        createdById: architect.id,
        endpoints: {
          create: source.endpoints.map((ep) => ({
            hostname: ep.hostname,
            edr: ep.edr ?? undefined,
            osquery: ep.osquery ?? undefined,
            artifactName: ep.artifactName,
            artifactSize: ep.artifactSize,
            artifactKey: ep.artifactKey,
          })),
        },
      },
      include: { endpoints: true },
    });
    console.log(`\n  ✓ Created ASSESSMENT “${scenario.title}”`);
    console.log(`    ID: ${scenario.id}`);
    console.log(`    Ref: /s/${scenario.refToken}`);
  } else {
    console.log(`\n  ✓ Using existing ASSESSMENT “${scenario.title}” (${scenario.id})`);
  }

  const binding = await prisma.cohortScenario.upsert({
    where: { cohortId_scenarioId: { cohortId: cohort.id, scenarioId: scenario.id } },
    create: {
      cohortId: cohort.id,
      scenarioId: scenario.id,
      boundById: architect.id,
    },
    update: {},
  });
  console.log(`  ✓ Bound to cohort “${cohort.name}” (binding ${binding.id})`);

  const student = await prisma.user.findUnique({ where: { email: SAMPLE_STUDENT_EMAIL } });
  if (student) {
    const flags = (scenario.flags as { id?: string; question?: string }[] | null) ?? [];
    const flagAnswers: Record<string, string> = {};
    if (flags.length >= 2) {
      flagAnswers[flags[0].id ?? "f1"] = "185.220.101.34";
      flagAnswers[flags[1].id ?? "f2"] = "winword.exe";
    } else {
      flagAnswers.f1 = "185.220.101.34";
      flagAnswers.f2 = "winword.exe";
    }

    const now = new Date();
    const submission = await prisma.submission.upsert({
      where: { scenarioId_studentId: { scenarioId: scenario.id, studentId: student.id } },
      create: {
        scenarioId: scenario.id,
        studentId: student.id,
        report:
          "Sample incident report: malicious macro in WINWORD.EXE launched powershell.exe; outbound C2 to 185.220.101.34:4444. Recommend isolating win-ep-04 and blocking the C2 IP at the perimeter.",
        flagAnswers,
        status: "GRADED",
        grade: 85,
        feedback: "Solid triage and report. Good identification of parent process and C2.",
        gradedById: architect.id,
        gradedAt: now,
        releasedAt: now,
        submittedAt: new Date(now.getTime() - 3600_000),
      },
      update: {
        status: "GRADED",
        grade: 85,
        feedback: "Solid triage and report. Good identification of parent process and C2.",
        gradedById: architect.id,
        gradedAt: now,
        releasedAt: now,
      },
    });
    console.log(`  ✓ Sample released grade (85%) for ${SAMPLE_STUDENT_EMAIL} (submission ${submission.id})`);
  } else {
    console.log(`  ⚠ Student ${SAMPLE_STUDENT_EMAIL} not found — skipped sample grade`);
  }

  console.log(`\n  Students in this cohort can open: http://localhost:3000/s/${scenario.refToken}`);
  console.log(`  Zaio transcript should show this after Re-sync Athena.\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("\n  ✗ Seed failed:\n", err);
  process.exit(1);
});
