import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { normalizeFlags, normalizeObjectives, normalizeTechniques } from "@/lib/scenario-schemas";
import { audit, type Manage } from "@/lib/labs/manage";

/**
 * Editing a SOC scenario's details: what the scenario editor's Save does
 * (src/app/actions/scenarios.ts), shared with the MCP tools (docs/mcp.md).
 * Runs as `actorId` (an architect; callers check) and is audited. Visibility
 * is separate: setScenarioVisibilityAs in src/lib/labs/manage.ts.
 */

export type ScenarioDetails = {
  title?: string;
  description?: string;
  type?: "DOJO" | "ASSESSMENT";
  brief?: string;
  realtime?: boolean;
  reportRequired?: boolean;
  reportPrompt?: string | null;
  /** Replaces the whole list. */
  objectives?: { text: string }[];
  /** Replaces the whole list; ids are renumbered f1, f2, … */
  flags?: { question: string; answer: string; points?: number }[];
  techniques?: unknown;
};

export async function updateScenarioDetailsAs(actorId: string, scenarioId: string, input: ScenarioDetails): Promise<Manage<{ changed: string[] }>> {
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId }, select: { kind: true, type: true, hidden: true } });
  if (!scenario) return { error: "No such scenario." };
  if (scenario.kind !== "SOC") return { error: "That's a lab: its details are edited with the lab tools (update_scenario_details takes a lab's title, description, brief and techniques)." };

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = String(input.title).trim();
    if (!title) return { error: "Title is required." };
    data.title = title;
  }
  if (input.description !== undefined) data.description = String(input.description).trim();
  if (input.type !== undefined) {
    if (input.type !== "DOJO" && input.type !== "ASSESSMENT") return { error: "type must be DOJO or ASSESSMENT." };
    data.type = input.type;
    // Hidden is a Dojo-only idea: an assessment is always listed to its cohorts.
    if (input.type === "ASSESSMENT" && scenario.hidden) data.hidden = false;
  }
  if (input.brief !== undefined) data.brief = String(input.brief);
  if (input.realtime !== undefined) data.realtime = Boolean(input.realtime);
  if (input.reportRequired !== undefined) data.reportRequired = Boolean(input.reportRequired);
  if (input.reportPrompt !== undefined) data.reportPrompt = String(input.reportPrompt ?? "").trim() || null;
  if (input.objectives !== undefined) data.objectives = normalizeObjectives(input.objectives);
  if (input.flags !== undefined) data.flags = normalizeFlags(input.flags);
  if (input.techniques !== undefined) data.techniques = normalizeTechniques(input.techniques);

  const changed = Object.keys(data);
  if (!changed.length) return { error: "Nothing to change." };
  await prisma.scenario.update({ where: { id: scenarioId }, data });
  await audit("SCENARIO_DETAILS", actorId, { scenarioId, changed });
  revalidatePath(`/admin/scenarios/${scenarioId}`);
  revalidatePath("/admin/scenarios");
  return { ok: true, changed };
}
