"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireArchitect, requireUser } from "@/lib/auth";
import { isAuthorizedForScenario } from "@/lib/student";
import { isStorageConfigured } from "@/lib/settings";
import { putObject, deleteObject } from "@/lib/storage";
import { parseGuide, guideRelPath, normalizeAnswer, type GuidePrompt } from "@/lib/guide";

export type GuideUploadResult = { error?: string; ok?: string };

function contentTypeFor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return (
    { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp" }[
      ext ?? ""
    ] ?? "application/octet-stream"
  );
}

/**
 * Save a teaching guide from an uploaded folder (main.md + image assets).
 * Called directly (files + parallel `paths` array in FormData).
 */
export async function uploadGuide(scenarioId: string, formData: FormData): Promise<GuideUploadResult> {
  await requireArchitect();

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  let paths: string[] = [];
  try {
    paths = JSON.parse(String(formData.get("paths") ?? "[]"));
  } catch {
    paths = [];
  }
  if (files.length !== paths.length || files.length === 0) {
    return { error: "No files received." };
  }

  const rel = paths.map(guideRelPath);
  const mainIdx = rel.findIndex((p) => p.toLowerCase() === "main.md");
  if (mainIdx === -1) {
    return { error: "The folder must contain a main.md at its root." };
  }

  const markdown = await files[mainIdx].text();
  const { guide, prompts } = parseGuide(markdown);

  // Everything except main.md is an asset.
  const assets = rel
    .map((p, i) => ({ path: p, file: files[i] }))
    .filter((_a, i) => i !== mainIdx && files[i].size > 0);

  if (assets.length > 0 && !(await isStorageConfigured())) {
    return { error: "Configure object storage (Settings → Storage) to upload guide images." };
  }

  for (const a of assets) {
    try {
      await putObject(
        `scenarios/${scenarioId}/guide/${a.path}`,
        Buffer.from(await a.file.arrayBuffer()),
        contentTypeFor(a.path),
      );
    } catch (e) {
      return { error: `Failed to upload ${a.path}: ${e instanceof Error ? e.message : "error"}` };
    }
  }

  await prisma.scenario.update({
    where: { id: scenarioId },
    data: { guide, guidePrompts: prompts, guideAssets: assets.map((a) => a.path) },
  });

  revalidatePath(`/admin/scenarios/${scenarioId}`);
  return {
    ok: `Guide saved — ${prompts.length} prompt${prompts.length === 1 ? "" : "s"}, ${assets.length} asset${assets.length === 1 ? "" : "s"}.`,
  };
}

/** Remove a scenario's guide (and its stored assets). */
export async function removeGuide(scenarioId: string): Promise<{ error?: string }> {
  await requireArchitect();
  const sc = await prisma.scenario.findUnique({ where: { id: scenarioId }, select: { guideAssets: true } });
  const assets = Array.isArray(sc?.guideAssets) ? (sc.guideAssets as string[]) : [];
  for (const p of assets) await deleteObject(`scenarios/${scenarioId}/guide/${p}`).catch(() => {});

  await prisma.scenario.update({
    where: { id: scenarioId },
    data: { guide: null, guidePrompts: undefined, guideAssets: undefined },
  });
  revalidatePath(`/admin/scenarios/${scenarioId}`);
  return {};
}

export type PromptCheckResult = { correct: boolean; hint?: string | null; error?: string };

/** Check a student's answer to a guide prompt (CTF-style). Persists solves. */
export async function checkGuidePrompt(
  scenarioId: string,
  promptId: string,
  answer: string,
): Promise<PromptCheckResult> {
  const user = await requireUser();
  if (user.role !== "STUDENT") return { correct: false, error: "Only students answer prompts." };
  if (!(await isAuthorizedForScenario(user.id, scenarioId))) {
    return { correct: false, error: "You don't have access to this scenario." };
  }

  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId }, select: { guidePrompts: true } });
  const prompts = Array.isArray(scenario?.guidePrompts) ? (scenario.guidePrompts as GuidePrompt[]) : [];
  const prompt = prompts.find((p) => p.id === promptId);
  if (!prompt) return { correct: false, error: "Unknown prompt." };

  if (normalizeAnswer(answer) !== normalizeAnswer(prompt.answer)) {
    return { correct: false, hint: prompt.hint || null };
  }

  await prisma.guidePromptSolve
    .upsert({
      where: { scenarioId_studentId_promptId: { scenarioId, studentId: user.id, promptId } },
      update: {},
      create: { scenarioId, studentId: user.id, promptId },
    })
    .catch(() => {});
  return { correct: true };
}
