"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isAuthorizedForScenario } from "@/lib/student";

const VERDICTS = ["TRUE_POSITIVE", "FALSE_POSITIVE", "BENIGN", "ESCALATED"] as const;

export type SaveCaseInput = {
  verdict?: string | null;
  status?: string;
  notes?: string;
  iocs?: { type?: string; value?: string }[];
};
export type SaveCaseResult = { error?: string; ok?: boolean };

/** Create/update a student's case work on a single alert (verdict, notes, IoCs). */
export async function saveAlertCase(
  scenarioId: string,
  alertId: string,
  input: SaveCaseInput,
): Promise<SaveCaseResult> {
  const user = await requireUser();
  if (user.role !== "STUDENT") return { error: "Only students manage cases." };
  if (!(await isAuthorizedForScenario(user.id, scenarioId))) {
    return { error: "You don't have access to this scenario." };
  }
  if (!alertId) return { error: "Missing alert." };

  const verdict = VERDICTS.includes(input.verdict as (typeof VERDICTS)[number])
    ? (input.verdict as (typeof VERDICTS)[number])
    : null;
  const status = input.status === "CLOSED" ? "CLOSED" : "OPEN";
  const notes = String(input.notes ?? "").trim() || null;
  const iocs = Array.isArray(input.iocs)
    ? input.iocs
        .map((i) => ({ type: String(i.type || "other"), value: String(i.value ?? "").trim() }))
        .filter((i) => i.value)
    : [];

  await prisma.alertCase.upsert({
    where: { scenarioId_studentId_alertId: { scenarioId, studentId: user.id, alertId } },
    update: { verdict, status, notes, iocs },
    create: { scenarioId, studentId: user.id, alertId, verdict, status, notes, iocs },
  });

  revalidatePath(`/learn/${scenarioId}`);
  return { ok: true };
}
