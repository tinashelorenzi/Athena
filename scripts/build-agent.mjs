/**
 * Build the zaio agent for every Linux target Athena serves at /agent/
 * (docs/labs/spec.md section 6). Needs Go 1.24+.
 *
 *   npm run agent:build
 *
 * Writes to agent/dist/:
 *   zaio-linux-{amd64,arm64}      static binaries
 *   zaio_<version>_{amd64,arm64}.deb   Debian/Ubuntu packages (binary + systemd unit + maintainer scripts)
 *   SHA256SUMS, manifest.json
 * The version comes from agent/VERSION.
 *
 *   node scripts/build-agent.mjs --package-only
 *
 * skips compiling and packages binaries already in agent/dist (the Docker
 * image compiles them in a Go stage).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDeb } from "./deb.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentDir = path.join(root, "agent");
const dist = path.join(agentDir, "dist");
const version = readFileSync(path.join(agentDir, "VERSION"), "utf8").trim();
const ARCHES = ["amd64", "arm64"];

function findGo() {
  for (const candidate of [process.env.GO, "go", "C:/Program Files/Go/bin/go.exe", "/usr/local/go/bin/go"]) {
    if (!candidate) continue;
    try {
      execFileSync(candidate, ["version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try the next one
    }
  }
  throw new Error("Go was not found. Install Go 1.24+ (https://go.dev/dl/) or set GO=/path/to/go.");
}

const packageOnly = process.argv.includes("--package-only") || process.argv.includes("--checksums-only");
const go = packageOnly ? null : findGo();
mkdirSync(dist, { recursive: true });
// Old packages from earlier versions would otherwise linger and be served.
for (const f of readdirSync(dist)) if (f.endsWith(".deb")) rmSync(path.join(dist, f));

const read = (p) => readFileSync(path.join(agentDir, "packaging", p), "utf8");
const unit = read("zaio.service");
const scripts = { postinst: read("deb/postinst"), prerm: read("deb/prerm"), postrm: read("deb/postrm") };
const readme = `zaio — the Athena Labs agent (${version}).

Links this machine to an Athena account and collects evidence for lab
sessions. Commands: sudo zaio setup | status | labs | start | check | end | undo
Service: systemctl status zaio · logs: journalctl -u zaio
Removing the package restores anything a running lab session turned off (SSH).
`;

const files = [];
const record = (name, kind, arch) => {
  const p = path.join(dist, name);
  files.push({ name, kind, arch, size: statSync(p).size, sha256: createHash("sha256").update(readFileSync(p)).digest("hex") });
};

for (const arch of ARCHES) {
  const bin = `zaio-linux-${arch}`;
  const out = path.join(dist, bin);
  if (go) {
    execFileSync(go, ["build", "-trimpath", "-ldflags", `-s -w -X main.version=${version}`, "-o", out, "./cmd/zaio"], {
      cwd: agentDir,
      stdio: "inherit",
      env: { ...process.env, GOOS: "linux", GOARCH: arch, CGO_ENABLED: "0" },
    });
  }
  record(bin, "binary", arch);

  const deb = `zaio_${version}_${arch}.deb`;
  writeFileSync(
    path.join(dist, deb),
    buildDeb({
      name: "zaio",
      version,
      arch,
      maintainer: "Zaio Institute of Technology <labs@zaio.io>",
      homepage: "https://zaio.io",
      description: "Athena Labs agent\nLinks a student's VM to Athena and collects evidence for graded lab sessions.",
      files: [
        { path: "/usr/bin/zaio", mode: 0o755, data: readFileSync(out) },
        { path: "/lib/systemd/system/zaio.service", mode: 0o644, data: unit },
        { path: "/usr/share/doc/zaio/README", mode: 0o644, data: readme },
      ],
      scripts,
    }),
  );
  record(deb, "deb", arch);
}

writeFileSync(path.join(dist, "SHA256SUMS"), files.map((f) => `${f.sha256}  ${f.name}\n`).join(""));
writeFileSync(path.join(dist, "manifest.json"), JSON.stringify({ version, builtAt: new Date().toISOString(), files }, null, 2) + "\n");
console.log(`zaio ${version}: ${files.map((f) => `${f.name} (${(f.size / 1e6).toFixed(1)} MB)`).join(", ")}`);
