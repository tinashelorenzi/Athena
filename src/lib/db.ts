import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Shared Prisma client (server-only).
 *
 * Prisma 7's Rust-free client connects through a driver adapter rather than a
 * `url` in the schema. We use the node-postgres adapter, pointed at
 * DATABASE_URL (loaded automatically by Next.js from `.env`).
 *
 * The instance is cached on `globalThis` in development so that Next.js's hot
 * reload doesn't open a new connection pool on every edit.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — check your .env file.");
}

const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
