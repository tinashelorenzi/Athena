import { prisma } from "@/lib/db";
import { putObject } from "@/lib/storage";
import { isStorageConfigured } from "@/lib/settings";
import { newRefToken } from "@/lib/scenarios";
import type { FolderFile, LabFolderReport } from "./folder";

/**
 * Persist a lab folder that passed checkLabFolder (server-only). A new slug
 * creates a LAB scenario + Lab + version 1; an existing slug updates the
 * scenario's details and adds the next immutable LabVersion, so running
 * sessions keep grading against the version they started on.
 */

export type SaveLabResult = { ok: true; scenarioId: string; labId: string; version: number; created: boolean } | { ok: false; error: string };

/** Largest cohort, for the compiler's `unique: cohort` space check. */
export async function largestCohortSize(): Promise<number> {
  const rows = await prisma.user.groupBy({ by: ["cohortId"], where: { role: "STUDENT", cohortId: { not: null } }, _count: { _all: true } });
  return rows.reduce((n, r) => Math.max(n, r._count._all), 0);
}

export async function saveLab(report: LabFolderReport, files: FolderFile[], createdById: string): Promise<SaveLabResult> {
  if (!report.ok || !report.meta || !report.lab) return { ok: false, error: "The lab folder has errors." };
  const { meta, lab } = report;
  if (report.assets.length && !(await isStorageConfigured())) {
    return { ok: false, error: "This lab has assets (lab/assets/) — configure object storage (Settings → Storage) first." };
  }

  const existing = await prisma.lab.findUnique({ where: { slug: meta.slug }, include: { scenario: { select: { kind: true } }, versions: { select: { version: true }, orderBy: { version: "desc" }, take: 1 } } });
  if (existing && existing.scenario.kind !== "LAB") return { ok: false, error: `Slug "${meta.slug}" belongs to a non-lab scenario.` };

  const scenarioData = {
    title: meta.title,
    description: meta.description,
    type: meta.type,
    exposure: meta.exposure,
    hidden: meta.hidden,
    brief: meta.brief,
    techniques: meta.techniques,
  } as const;

  let labId: string;
  let scenarioId: string;
  if (existing) {
    labId = existing.id;
    scenarioId = existing.scenarioId;
  } else {
    const scenario = await prisma.scenario.create({
      data: { ...scenarioData, kind: "LAB", refToken: newRefToken(), createdById, lab: { create: { slug: meta.slug } } },
      include: { lab: { select: { id: true } } },
    });
    scenarioId = scenario.id;
    labId = scenario.lab!.id;
  }
  const version = (existing?.versions[0]?.version ?? 0) + 1;

  // Upload assets before recording the version, so a version never points at missing files.
  const byRel = new Map(files.map((f) => [f.rel, f]));
  const assets = [];
  try {
    for (const a of report.assets) {
      const storageKey = `labs/${labId}/v${version}/assets/${a.file.split("/").pop()}`;
      await putObject(storageKey, Buffer.from(await byRel.get(a.file)!.bytes()), "application/octet-stream");
      assets.push({ ...a, storageKey });
    }
  } catch (e) {
    if (!existing) await prisma.scenario.delete({ where: { id: scenarioId } }).catch(() => {});
    return { ok: false, error: `Uploading lab assets failed: ${e instanceof Error ? e.message : e}` };
  }

  await prisma.$transaction([
    ...(existing ? [prisma.scenario.update({ where: { id: scenarioId }, data: scenarioData })] : []),
    prisma.labVersion.create({
      data: {
        labId,
        version,
        zcl: lab.zcl,
        definition: lab as object,
        assets: assets as object[],
        gate: { ...report.gate, warnings: report.warnings, checkedAt: new Date().toISOString() } as object,
        source: report.source ?? null,
        references: (report.references ?? undefined) as object | undefined,
        createdById,
      },
    }),
  ]);
  return { ok: true, scenarioId, labId, version, created: !existing };
}
