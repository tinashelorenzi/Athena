import path from "node:path";
import AdmZip from "adm-zip";
import { getCurrentUser } from "@/lib/auth";

/**
 * Download the example auto-build bundle (docs/examples/scenario-autobuild) as a
 * zip, so instructors can grab it, tweak it, and drop it into the Auto-builder.
 * Instructor-only.
 */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") return new Response("Forbidden", { status: 403 });

  try {
    const dir = path.join(process.cwd(), "docs", "examples", "scenario-autobuild");
    const zip = new AdmZip();
    zip.addLocalFolder(dir, "scenario-autobuild-example");
    const buf = zip.toBuffer();
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="scenario-autobuild-example.zip"',
      },
    });
  } catch {
    return new Response("Example bundle unavailable in this deployment.", { status: 404 });
  }
}
