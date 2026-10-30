"use server";

import { requireArchitect } from "@/lib/auth";
import { autoBuildBundle, bundleFromPaths, type AutoBuildResult } from "@/lib/autobuild";

export type { AutoBuildResult, LabBuildReport } from "@/lib/autobuild";

/**
 * Auto-build a whole scenario from a single dropped folder (see
 * docs/autobuild.md). The work is in src/lib/autobuild.ts, shared with the
 * MCP server's `autobuild` tool (docs/mcp.md).
 */
export async function autoBuildScenario(formData: FormData): Promise<AutoBuildResult> {
  const architect = await requireArchitect();

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  let paths: string[] = [];
  try {
    paths = JSON.parse(String(formData.get("paths") ?? "[]"));
  } catch {
    paths = [];
  }
  if (!files.length || files.length !== paths.length) return { error: "No files received." };

  return autoBuildBundle(bundleFromPaths(paths, files), architect.id);
}
