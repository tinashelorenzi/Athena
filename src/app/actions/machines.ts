"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createEnrollCode } from "@/lib/labs/machines";

export type EnrollCodeState = { error?: string; code?: string; expiresAt?: string };

/** Issue a one-time enrolment code for the signed-in user (shown once, 10 minutes). */
export async function generateEnrollCode(): Promise<EnrollCodeState> {
  const user = await requireUser();
  const { code, expiresAt } = await createEnrollCode(user.id);
  return { code, expiresAt: expiresAt.toISOString() };
}

/** Rename one of the user's machines. */
export async function renameMachine(id: string, label: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const clean = String(label ?? "").trim().slice(0, 40);
  if (!clean) return { error: "Give the machine a name." };
  const { count } = await prisma.machine.updateMany({ where: { id, userId: user.id }, data: { label: clean } });
  if (!count) return { error: "Machine not found." };
  revalidatePath("/machines");
  return {};
}

/** Remove (revoke) one of the user's machines; its agent is refused from then on. */
export async function removeMachine(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const { count } = await prisma.machine.updateMany({
    where: { id, userId: user.id, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  if (!count) return { error: "Machine not found." };
  await prisma.labAuditEvent.create({ data: { type: "REVOKE", userId: user.id, machineId: id, detail: { by: "owner" } } });
  revalidatePath("/machines");
  return {};
}
