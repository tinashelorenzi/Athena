#!/usr/bin/env bash
#
# Mint a MinIO service account scoped to the Athena bucket, for pasting into
# Athena → Settings → Storage. Run after `docker compose up -d` (MinIO + the
# bucket must already exist).
#
#   ./minio-credentials.sh            (or: bash minio-credentials.sh)
#
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "✗ .env not found — copy .env.example to .env first."; exit 1; }
set -a; . ./.env; set +a
: "${MINIO_ROOT_USER:?set MINIO_ROOT_USER in .env}"
: "${MINIO_BUCKET:?set MINIO_BUCKET in .env}"

# Scope the key to just this bucket (read/write).
POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:*"],"Resource":["arn:aws:s3:::'"$MINIO_BUCKET"'","arn:aws:s3:::'"$MINIO_BUCKET"'/*"]}]}'

echo "Minting a scoped MinIO service account for bucket '$MINIO_BUCKET'…"
OUT=$(docker compose run --rm \
  -e SVC_POLICY="$POLICY" \
  -e SVC_PARENT="$MINIO_ROOT_USER" \
  --entrypoint sh minio-init -c '
    printf "%s" "$SVC_POLICY" > /tmp/p.json
    mc admin user svcacct add --policy /tmp/p.json --json local "$SVC_PARENT"
  ' 2>/dev/null) || true

ACCESS=$(printf "%s" "$OUT" | sed -n 's/.*"accessKey":"\([^"]*\)".*/\1/p' | head -1)
SECRET=$(printf "%s" "$OUT" | sed -n 's/.*"secretKey":"\([^"]*\)".*/\1/p' | head -1)

if [ -z "$ACCESS" ] || [ -z "$SECRET" ]; then
  echo "✗ Could not create credentials. Is the stack running?  (docker compose up -d)"
  [ -n "$OUT" ] && echo "$OUT"
  exit 1
fi

cat <<EOF

  ✓ MinIO storage credentials created. Enter these in Athena → Settings → Storage:

    Provider           MinIO / S3-compatible
    Endpoint           http://localhost:${MINIO_PORT:-9000}
                       (use http://minio:9000 if Athena runs via 'docker compose --profile app')
    Bucket             $MINIO_BUCKET
    Region             us-east-1
    Force path-style   on
    Access key ID      $ACCESS
    Secret access key  $SECRET

  Then click "Test connection" to confirm.

EOF
