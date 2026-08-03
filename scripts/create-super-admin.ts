/**
 * Create a SUPER_ADMIN (instructor) account.
 *
 *   npm run create:superadmin
 *
 * Prompts for the instructor's email and name, generates a strong random
 * password (the instructor does not choose one), hashes it with Argon2id, and
 * writes the account to the database. The generated password is printed once —
 * there is no way to recover it afterwards, only reset it.
 *
 * Run via `tsx` (see package.json) so the `@/` path alias and the generated
 * Prisma client resolve the same way they do inside Next.js.
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  // tsx/Node do not auto-load `.env` for standalone scripts; do it before the
  // dynamic imports below so src/lib/db.ts sees DATABASE_URL at load time.
  try {
    process.loadEnvFile();
  } catch {
    // No .env file — assume the environment is already populated.
  }

  // Imported dynamically *after* the env is loaded (db.ts reads DATABASE_URL at
  // import time).
  const { prisma } = await import("@/lib/db");
  const { hashPassword, generatePassword } = await import("@/lib/password");

  const rl = createInterface({ input, output });

  // Consume input line-by-line via the async iterator rather than rl.question():
  // this buffers piped input so it works both interactively (TTY) and when
  // answers are piped in, instead of racing the stream's EOF close.
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (prompt: string): Promise<string> => {
    output.write(prompt);
    const next = await lines.next();
    if (next.done) throw new Error("Input ended before all prompts were answered.");
    return next.value.trim();
  };

  try {
    console.log("\n  Athena — create SUPER_ADMIN (instructor) account\n");

    let email = "";
    while (!email) {
      const answer = (await ask("  Email address: ")).toLowerCase();
      if (!EMAIL_RE.test(answer)) {
        console.log("  ✗ That doesn't look like a valid email. Try again.\n");
        continue;
      }
      const existing = await prisma.user.findUnique({ where: { email: answer } });
      if (existing) {
        console.log(`  ✗ An account already exists for ${answer}. Aborting.\n`);
        process.exitCode = 1;
        return;
      }
      email = answer;
    }

    let name = "";
    while (!name) {
      name = await ask("  Name(s) of instructor: ");
      if (!name) console.log("  ✗ Name cannot be empty. Try again.\n");
    }

    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { email, name, passwordHash, role: "SUPER_ADMIN" },
    });

    console.log("\n  ✓ Super admin created.\n");
    console.log("  ──────────────────────────────────────────────");
    console.log(`  ID:       ${user.id}`);
    console.log(`  Name:     ${user.name}`);
    console.log(`  Email:    ${user.email}`);
    console.log(`  Password: ${password}`);
    console.log("  ──────────────────────────────────────────────");
    console.log("\n  Store this password now — it is shown only once and cannot");
    console.log("  be recovered, only reset.\n");
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\n  ✗ Failed to create super admin:\n", err);
  process.exit(1);
});
