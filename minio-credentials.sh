#!/usr/bin/env bash
#
# Print the storage settings to enter in Athena → Settings → Storage, after
# making sure the storage container is up and the bucket exists.
#
#   ./minio-credentials.sh            (or: bash minio-credentials.sh)
#
# Storage is RustFS (S3-compatible) since 2026-10, when MinIO stopped
# publishing container images; the script keeps its old name and the MINIO_*
# .env variables so existing setups and habits still work. See docs/deploy.md.
#
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "✗ .env not found — copy .env.example to .env first."; exit 1; }
set -a; . ./.env; set +a
: "${MINIO_ROOT_USER:?set MINIO_ROOT_USER in .env}"
: "${MINIO_ROOT_PASSWORD:?set MINIO_ROOT_PASSWORD in .env}"
: "${MINIO_BUCKET:?set MINIO_BUCKET in .env}"
PORT="${MINIO_PORT:-9000}"
CONSOLE_PORT="${MINIO_CONSOLE_PORT:-9001}"

if ! curl -sf "http://localhost:${PORT}/health" >/dev/null; then
  echo "✗ Storage isn't answering on http://localhost:${PORT}. Start it with: docker compose up -d"
  exit 1
fi

echo "Making sure bucket '${MINIO_BUCKET}' exists…"
docker compose run --rm storage-init >/dev/null 2>&1 || {
  echo "✗ Could not create or reach the bucket. Check: docker compose logs storage"
  exit 1
}

cat <<EOF

  ✓ Storage is up and bucket '${MINIO_BUCKET}' exists. Enter these in Athena → Settings → Storage:

    Provider           MinIO / S3-compatible
    Endpoint           http://localhost:${PORT}
                       (use http://storage:9000 if Athena runs via 'docker compose --profile app')
    Bucket             ${MINIO_BUCKET}
    Region             us-east-1
    Force path-style   on
    Access key ID      ${MINIO_ROOT_USER}
    Secret access key  ${MINIO_ROOT_PASSWORD}

  Then click "Test connection" to confirm.

  These are the storage root credentials from .env. To give Athena a separate
  key instead, create one in the RustFS console (http://localhost:${CONSOLE_PORT}/rustfs/console/,
  sign in with the same credentials → Access Keys) and paste that pair here.

EOF
