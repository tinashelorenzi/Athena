/**
 * Local-dev fixture for Labs: a test student to enrol WSL/VirtualBox machines
 * against a local Athena (docs/labs/spec.md, milestone M1).
 *
 *   npm run seed:lab-dev
 *
 * Creates or resets `lab.student@athena.test` (student) and `lab.architect@athena.test`
 * (instructor with architect rights, to upload labs) with the dev-only password below.
 * Refuses to run unless DATABASE_URL points at localhost, so it can never touch
 * a real database.
 */
const EMAIL = "lab.student@athena.test";
const PASSWORD = "lab-student-dev-only"; // local test account only
const NAME = "Lab Test Student";
const ARCHITECT_EMAIL = "lab.architect@athena.test";

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    // No .env — assume the environment is already populated.
  }
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://unset").hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(`Refusing to seed: DATABASE_URL host is ${host}, not localhost.`);
  }

  const { prisma } = await import("@/lib/db");
  const { hashPassword } = await import("@/lib/password");
  const passwordHash = await hashPassword(PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, mustSetName: false },
    create: { email: EMAIL, name: NAME, passwordHash, role: "STUDENT" },
  });
  const architect = await prisma.user.upsert({
    where: { email: ARCHITECT_EMAIL },
    update: { passwordHash, mustSetName: false, role: "SUPER_ADMIN", isArchitect: true },
    create: { email: ARCHITECT_EMAIL, name: "Lab Test Architect", passwordHash, role: "SUPER_ADMIN", isArchitect: true },
  });
  console.log(`Test student ready: ${user.email} (id ${user.id}).`);
  console.log(`Test architect ready: ${architect.email} (id ${architect.id}). Password: see scripts/seed-lab-dev.ts.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

export {}; // a module, so `main` doesn't collide with other scripts' globals
