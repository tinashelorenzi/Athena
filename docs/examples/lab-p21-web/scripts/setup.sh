#!/usr/bin/env bash
# Practical 21 setup: installs the starting state of the Vukani portal server.
# Students run it with the curl command in the brief; Athena fills in their values.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root (the brief's command uses sudo)." >&2
  exit 1
fi

echo "==> Installing nginx, Snort, curl and jq"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx snort curl jq >/dev/null

echo "==> Starting nginx"
systemctl enable --now nginx >/dev/null

# Last week's portal traffic, the pentest included: a lab file, too big to paste
# into a script, downloaded through the student's own link.
echo "==> Fetching last week's portal traffic"
curl -fsSL {{file.portal_history_json}} -o /root/portal-history.json

# Leave the student's own values on the machine for reference.
cat > /root/p21-values.txt <<VALUES
Node tag:  {{param.token}}
SID block: {{param.sid_base}} to $(( {{param.sid_base}} + 9999 ))
VALUES

echo
echo "Ready. Your node tag is {{param.token}}; your Snort SIDs start at {{param.sid_base}}."
echo "Last week's traffic, the pentest included, is in /root/portal-history.json (try: jq '.[] | select(.ua | test(\"sqlmap\"))' /root/portal-history.json)."
echo "(Saved in /root/p21-values.txt.) Now link this machine and start the lab: sudo zaio start p21-web"
