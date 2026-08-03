/**
 * Promote an instructor to Architect (may author Dojo/Assessment scenarios).
 *
 *   npm run promote:architect
 *
 * Lists all instructor (SUPER_ADMIN) accounts and prompts you to pick one to
 * grant the architect attribute. Run via `tsx` (see package.json).
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    // No .env — assume env already populated.
  }

  const { prisma } = await import("@/lib/db");

  const rl = createInterface({ input, output });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (prompt: string): Promise<string> => {
    output.write(prompt);
    const next = await lines.next();
    if (next.done) throw new Error("Input ended before selection.");
    return next.value.trim();
  };

  try {
    const instructors = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, isArchitect: true },
    });

    console.log("\n  Athena — promote instructor to Architect\n");

    if (instructors.length === 0) {
      console.log("  No instructor accounts found. Create one with `npm run create:superadmin`.\n");
      return;
    }

    instructors.forEach((u, i) => {
      const tag = u.isArchitect ? "  [architect]" : "";
      console.log(`  ${String(i + 1).padStart(2)}. ${u.name} <${u.email}>${tag}`);
    });
    console.log("");

    const answer = await ask("  Select a number to promote (or 'q' to quit): ");
    if (answer.toLowerCase() === "q") return;

    const idx = Number(answer) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= instructors.length) {
      console.log("  ✗ Invalid selection.\n");
      process.exitCode = 1;
      return;
    }

    const target = instructors[idx];
    if (target.isArchitect) {
      console.log(`\n  ${target.name} is already an architect. Nothing to do.\n`);
      return;
    }

    await prisma.user.update({ where: { id: target.id }, data: { isArchitect: true } });
    console.log(`\n  ✓ ${target.name} <${target.email}> is now an Architect.\n`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\n  ✗ Failed to promote:\n", err);
  process.exit(1);
});
