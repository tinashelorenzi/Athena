#!/usr/bin/env bash
# Practical 21 setup: installs the starting state of the Vukani portal server.
# Students run it with the curl command in the brief; Athena fills in their values.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root (the brief's command uses sudo)." >&2
  exit 1
fi

echo "==> Installing nginx, Snort and curl"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx snort curl >/dev/null

echo "==> Starting nginx"
systemctl enable --now nginx >/dev/null

# Leave the student's own values on the machine for reference.
cat > /root/p21-values.txt <<VALUES
Node tag:  {{param.token}}
SID block: {{param.sid_base}} to $(( {{param.sid_base}} + 9999 ))
VALUES

echo
echo "Ready. Your node tag is {{param.token}}; your Snort SIDs start at {{param.sid_base}}."
echo "(Saved in /root/p21-values.txt.) Now link this machine and start the lab: sudo zaio start p21-web"
