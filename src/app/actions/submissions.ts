"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isAuthorizedForScenario, publicFlags } from "@/lib/student";
import { isStorageConfigured } from "@/lib/settings";
import { putObject, deleteObject } from "@/lib/storage";
import { completeRunFor } from "@/lib/run-engine";

export type SubmitState = { error?: string; ok?: string };

const MAX_REPORT_BYTES = 15 * 1024 * 1024; // 15 MB
const REPORT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

/**
 * Submit (or re-submit) a student's deliverables for a scenario: their flag
 * answers plus a report that is either typed inline or uploaded as a docx/pdf.
 * Instructors grade and then release the result afterwards.
 */
export async function submitScenario(
  scenarioId: string,
  _prevState: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const user = await requireUser();
  if (user.role !== "STUDENT") return { error: "Only students can submit." };
  if (!(await isAuthorizedForScenario(user.id, scenarioId))) {
    return { error: "You don't have access to this scenario." };
  }

  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: { flags: true, reportRequired: true, type: true },
  });
  if (!scenario) return { error: "Scenario not found." };

  const existing = await prisma.submission.findUnique({
    where: { scenarioId_studentId: { scenarioId, studentId: user.id } },
    select: { reportFileKey: true },
  });

  // Collect an answer per flag from fields named `flag:<id>`.
  const flags = publicFlags(scenario.flags);
  const flagAnswers: Record<string, string> = {};
  for (const f of flags) {
    flagAnswers[f.id] = String(formData.get(`flag:${f.id}`) ?? "").trim();
  }

  const report = String(formData.get("report") ?? "").trim();
  const removeFile = String(formData.get("removeReportFile") ?? "") === "1";
  const upload = formData.get("reportFile");
  const hasUpload = upload instanceof File && upload.size > 0;

  // Report file handling: upload a new one, keep the old, or clear it.
  let fileFields: {
    reportFileKey: string | null;
    reportFileName: string | null;
    reportFileType: string | null;
    reportFileSize: number | null;
  } | null = null;

  if (hasUpload) {
    const file = upload as File;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const contentType = REPORT_TYPES[ext];
    if (!contentType) return { error: "Report file must be a .pdf, .docx, or .doc." };
    if (file.size > MAX_REPORT_BYTES) return { error: "Report file is too large (max 15 MB)." };
    if (!(await isStorageConfigured())) {
      return { error: "Object storage isn't configured — type your report instead, or ask your instructor." };
    }
    const key = `submissions/${scenarioId}/${user.id}/report.${ext}`;
    try {
      await putObject(key, Buffer.from(await file.arrayBuffer()), contentType);
    } catch (e) {
      return { error: `Report upload failed: ${e instanceof Error ? e.message : "error"}` };
    }
    if (existing?.reportFileKey && existing.reportFileKey !== key) {
      await deleteObject(existing.reportFileKey).catch(() => {});
    }
    fileFields = { reportFileKey: key, reportFileName: file.name, reportFileType: contentType, reportFileSize: file.size };
  } else if (removeFile) {
    if (existing?.reportFileKey) await deleteObject(existing.reportFileKey).catch(() => {});
    fileFields = { reportFileKey: null, reportFileName: null, reportFileType: null, reportFileSize: null };
  }

  const willHaveFile = fileFields ? Boolean(fileFields.reportFileKey) : Boolean(existing?.reportFileKey);
  if (scenario.reportRequired && !report && !willHaveFile) {
    return { error: "A report is required — type one or upload a document." };
  }

  await prisma.submission.upsert({
    where: { scenarioId_studentId: { scenarioId, studentId: user.id } },
    update: {
      flagAnswers,
      report: report || null,
      status: "SUBMITTED",
      // A re-submission invalidates any prior grade/release.
      grade: null,
      feedback: null,
      gradedById: null,
      gradedAt: null,
      releasedAt: null,
      submittedAt: new Date(),
      ...(fileFields ?? {}),
    },
    create: { scenarioId, studentId: user.id, flagAnswers, report: report || null, ...(fileFields ?? {}) },
  });

  // Submitting an assessment finishes the run (it runs to the end, no re-do vibe).
  if (scenario.type === "ASSESSMENT") await completeRunFor(user.id, scenarioId);

  revalidatePath(`/learn/${scenarioId}`);
  return { ok: "Deliverables submitted. Your instructor will grade them." };
}
