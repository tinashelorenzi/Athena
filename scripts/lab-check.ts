/**
 * Check a lab folder offline — compile lab.yaml and run the reference-evidence
 * gate exactly as the Autobuilder does, without a database.
 *
 *   npm run lab:check -- docs/examples/lab-p21-web
 *
 * Exits 1 if the folder would be rejected.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { checkLabFolder, type FolderFile, type FolderIssue } from "@/lib/labs/folder";

async function walk(root: string, dir = root): Promise<FolderFile[]> {
  const out: FolderFile[] = [];
  for (const name of await readdir(dir)) {
    const abs = path.join(dir, name);
    const st = await stat(abs);
    if (st.isDirectory()) out.push(...(await walk(root, abs)));
    else {
      const rel = path.relative(root, abs).replace(/\\/g, "/");
      out.push({ rel, size: st.size, text: () => readFile(abs, "utf8"), bytes: async () => new Uint8Array(await readFile(abs)) });
    }
  }
  return out;
}

const where = (i: FolderIssue) => `${i.file}${i.line ? `:${i.line}` : ""}${i.path ? ` (${i.path})` : ""}`;

async function main() {
  const folder = process.argv[2];
  if (!folder) {
    console.error("usage: npm run lab:check -- <lab folder>");
    process.exit(2);
  }
  const report = await checkLabFolder(await walk(path.resolve(folder)));

  if (report.meta && report.lab) {
    const l = report.lab;
    console.log(`\n  ${report.meta.title}  [${report.meta.slug}, ${report.meta.type.toLowerCase()}]`);
    console.log(`  roles: ${Object.keys(l.machines).join(", ")} · params: ${Object.keys(l.params).join(", ") || "none"} · checks: ${l.checks.length} · max score ${l.maxScore}`);
    console.log(`  agent needs: ${l.capabilities.join(", ")} · assets: ${report.assets.map((a) => `${a.file} (${a.size} B)`).join(", ") || "none"}`);
  }
  for (const name of ["good", "broken"] as const) {
    const run = report.gate[name];
    if (!run) continue;
    console.log(`\n  ${name} reference: ${run.score}/${run.maxScore}${run.flags.length ? `  flags: ${run.flags.join(", ")}` : ""}`);
    for (const c of run.checks) {
      const mark = c.skipped ? "skip" : c.max === 0 ? (c.flagged ? "FLAG" : "ok  ") : c.passed ? "PASS" : "FAIL";
      console.log(`    ${mark}  ${c.id.padEnd(26)} ${c.max ? `${c.points}/${c.max}` : ""}${c.reason ? `   ${c.reason}` : ""}`);
    }
  }
  for (const w of report.warnings) console.log(`\n  warning  ${where(w)}: ${w.message}`);
  for (const e of report.errors) console.log(`\n  ERROR    ${where(e)}: ${e.message}`);
  console.log(report.ok ? "\n  ✔ The lab would be accepted.\n" : `\n  ✘ The lab would be rejected (${report.errors.length} error${report.errors.length === 1 ? "" : "s"}).\n`);
  process.exit(report.ok ? 0 : 1);
}

main();

export {};
