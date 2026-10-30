import { readFile } from "node:fs/promises";
import path from "node:path";
import { getBaseUrl } from "@/lib/url";

/**
 * Agent distribution: the binaries built by `npm run agent:build` (or the
 * Docker image's Go stage) and the generated install script. Served publicly
 * at /agent/* and, for typing on a VM console, /i (docs/labs/spec.md 6).
 */

export const AGENT_DIST = process.env.AGENT_DIST_DIR || path.join(process.cwd(), "agent", "dist");

export type AgentManifest = { version: string; builtAt: string; files: { name: string; kind: "binary" | "deb"; arch: string; sha256: string; size: number }[] };

export async function agentManifest(): Promise<AgentManifest | null> {
  try {
    return JSON.parse(await readFile(path.join(AGENT_DIST, "manifest.json"), "utf8"));
  } catch {
    return null;
  }
}

/** The install script for this Athena, or a script that explains no build exists (503). */
export async function installScriptResponse(): Promise<Response> {
  const m = await agentManifest();
  const base = await getBaseUrl();
  const body = m
    ? installScript(base, m.version)
    : `#!/bin/sh
echo "zaio install: this Athena has no agent build yet — an administrator must run: npm run agent:build" >&2
exit 1
`;
  return new Response(body, {
    status: m ? 200 : 503,
    headers: { "Content-Type": "text/x-shellscript; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Shell-quote a value for a single-quoted bash string. */
const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

function installScript(base: string, version: string): string {
  return `#!/usr/bin/env bash
# Athena Labs agent (zaio ${version}) installer, served by ${base}
#
#   curl -fsSL ${base}/agent/install.sh | sudo bash
#   curl -fsSL ${base}/agent/install.sh | sudo bash -s -- --email you@example.com --code XXXX-XXXX
#
# Downloads the agent for this CPU and checks its SHA-256. On Debian, Ubuntu and Kali it
# installs the zaio .deb (so \`apt remove zaio\` works and restores anything a
# lab session turned off); elsewhere it installs the binary to
# /usr/local/bin/zaio. Then it runs \`zaio setup\` to link this machine (any
# arguments are passed to setup). Re-running it upgrades the agent.
set -euo pipefail

ATHENA_URL=${sq(base)}
ZAIO_VERSION=${sq(version)}
die() { echo "zaio install: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run it as root: curl -fsSL $ATHENA_URL/agent/install.sh | sudo bash"
[ "$(uname -s)" = "Linux" ] || die "the agent runs on Linux only"
case "$(uname -m)" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) die "unsupported CPU: $(uname -m)" ;;
esac
command -v curl >/dev/null || die "curl is required (apt install curl)"
command -v sha256sum >/dev/null || die "sha256sum is required (apt install coreutils)"
# Read os-release in a subshell: it defines VERSION, NAME, ID … which would clobber ours.
OS_ID="$( (. /etc/os-release 2>/dev/null && echo "\${ID:-}") || true)"
OS_NAME="$( (. /etc/os-release 2>/dev/null && echo "\${PRETTY_NAME:-}") || true)"
case "$OS_ID" in
  ubuntu|kali) ;;
  *) echo "warning: labs are built for Ubuntu 22.04/24.04 and Kali Linux (this is \${OS_NAME:-an unknown system})" >&2 ;;
esac

if command -v dpkg >/dev/null 2>&1; then
  NAME="zaio_\${ZAIO_VERSION}_$ARCH.deb"
else
  NAME="zaio-linux-$ARCH"
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "Downloading zaio $ZAIO_VERSION ($ARCH) from $ATHENA_URL ..."
curl -fsSL "$ATHENA_URL/agent/$NAME" -o "$TMP/$NAME" || die "download failed"
curl -fsSL "$ATHENA_URL/agent/SHA256SUMS" -o "$TMP/SHA256SUMS" || die "download failed"
( cd "$TMP" && grep " $NAME\\$" SHA256SUMS | sha256sum -c --status ) \\
  || die "checksum mismatch: the download was corrupted or altered. Try again."

if [ "\${NAME%.deb}" != "$NAME" ]; then
  # The package's postinst restarts the agent if this machine is already linked.
  dpkg -i "$TMP/$NAME" >/dev/null || die "installing the package failed (see the dpkg messages above)"
  BIN=/usr/bin/zaio
else
  install -m 0755 "$TMP/$NAME" /usr/local/bin/zaio
  BIN=/usr/local/bin/zaio
  if [ -f /etc/zaio/agent.json ] && command -v systemctl >/dev/null && systemctl is-enabled zaio >/dev/null 2>&1; then
    systemctl restart zaio && echo "Restarted zaio.service"
  fi
fi
echo "Installed $($BIN version) to $BIN"

if [ -f /etc/zaio/agent.json ] && [ "$#" -eq 0 ]; then
  echo "This machine is already linked. Check it with: sudo zaio status"
  exit 0
fi

# Link the machine. Read answers from the terminal (stdin is this script).
if [ -e /dev/tty ] && (exec </dev/tty) 2>/dev/null; then
  exec "$BIN" setup --url "$ATHENA_URL" "$@" </dev/tty
elif [ "$#" -gt 0 ]; then
  exec "$BIN" setup --url "$ATHENA_URL" "$@"
else
  echo "Next: sudo zaio setup --url $ATHENA_URL"
fi
`;
}
