import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

/** Short, URL-safe token for a scenario's shareable reference link. */
export function newRefToken(): string {
  return randomBytes(9).toString("base64url");
}

/** Return a scenario's reference token, generating + persisting one if absent. */
export async function ensureRefToken(scenarioId: string): Promise<string> {
  const sc = await prisma.scenario.findUnique({ where: { id: scenarioId }, select: { refToken: true } });
  if (sc?.refToken) return sc.refToken;
  const token = newRefToken();
  await prisma.scenario.update({ where: { id: scenarioId }, data: { refToken: token } });
  return token;
}
