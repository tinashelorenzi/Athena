import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * The v7 config loader intentionally does NOT read `.env` files, so CLI
 * commands (`prisma migrate`, `prisma generate`, `prisma studio`) would not see
 * DATABASE_URL on their own. We load it here explicitly. (The Next.js runtime,
 * by contrast, loads `.env` automatically — see src/lib/db.ts.)
 */
try {
  process.loadEnvFile();
} catch {
  // No .env present (e.g. CI with vars already exported) — fall through.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Connection string used by Migrate and other CLI commands.
    url: env("DATABASE_URL"),
  },
});
