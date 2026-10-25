# Deploying Athena

`docker-compose.yml` runs the data services by default and the app behind a
profile. All values come from `.env` (start from `.env.example`).

```bash
docker compose up -d                  # Postgres + object storage + bucket
./minio-credentials.sh                # storage values for Settings → Storage
docker compose --profile app up -d    # also build and run the app + workers
```

Behind nginx, set `client_max_body_size 100M;` (scenario and lab uploads are
Server Actions with a 100 MB limit) and `APP_BASE_URL` to the public URL —
the agent installer bakes it into the commands students run.

## Labs agent (zaio)

Athena serves the agent students install on their VMs:
`curl -fsSL <athena>/i | sudo bash` (also `/agent/install.sh`) downloads
the `/agent/zaio_<version>_<arch>.deb` package (or the bare
`/agent/zaio-linux-<arch>` binary on non-Debian systems), checks it against
`/agent/SHA256SUMS`, and links the machine. Removing the package
(`apt remove zaio`) restores anything a running lab turned off (SSH). The binaries must be built for each release:

- **Docker** (`docker compose --profile app`): automatic — the image's Go stage
  builds them.
- **pm2 / plain host**: install Go 1.24+ on the build host and run
  `npm run agent:build` after `npm run build`. It writes `agent/dist/`
  (or point `AGENT_DIST_DIR` at a folder built elsewhere).

Without a build, `/i` answers with an error telling the student to ask an
administrator. Bump `agent/VERSION` when the agent changes; re-running the
installer on a linked machine upgrades it in place.

## Object storage

Storage is **RustFS** (`rustfs/rustfs`, Apache-2.0), an S3-compatible server.
It replaced MinIO in October 2026, when MinIO stopped publishing its container
images (`minio/minio` and `minio/mc` can no longer be pulled). Nothing else
changed for Athena: it talks plain S3 either way.

| Piece | What it does |
|---|---|
| `storage` service | RustFS on `MINIO_PORT` (S3 API, default 9000) and `MINIO_CONSOLE_PORT` (web console at `/rustfs/console/`, default 9001). Data in the `athena-rustfs` volume. Also reachable as `minio` inside the compose network, so a saved endpoint of `http://minio:9000` keeps working. |
| `storage-init` service | One-shot (`amazon/aws-cli`): creates `MINIO_BUCKET` if missing, then exits. New buckets have no public policy; files are served only through the app. |
| `./minio-credentials.sh` | Checks storage is up, makes sure the bucket exists, prints the values for **Settings → Storage**. |
| `.env` | Same variables as before: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`, `MINIO_PORT`, `MINIO_CONSOLE_PORT`. They are RustFS's root credentials now. |

**Settings → Storage**: provider *MinIO / S3-compatible*, path-style on,
region `us-east-1`, endpoint `http://localhost:9000` (or `http://storage:9000`
when Athena itself runs in compose), and the access key pair the script prints.
The old script minted a bucket-scoped MinIO service account; RustFS doesn't
have those keys, so **enter the new pair after switching**. For a key separate
from the root credentials, create one in the RustFS console (`http://<host>:9001/rustfs/console/` → Access Keys).

## Moving an existing MinIO install to RustFS

Only needed on a host that already ran the MinIO services and holds files
(guide images, evidence artifacts, lab assets). RustFS uses its own volume; the
old MinIO volume is left untouched and isn't listed in the compose file, so
`docker compose down -v` can't delete it. The commands assume a Linux host and
the compose project name `athena` (check with `docker volume ls | grep minio`).

1. **Stop the old MinIO container** (keep it — its image is needed to read the old data):

   ```bash
   docker stop athena-minio
   ```

2. **Start the new storage** (pull the updated compose file first):

   ```bash
   docker compose up -d storage storage-init
   ```

   Compose warns that `athena-minio` is an orphan container; leave it until step 6.

3. **Run the old MinIO read-only on a spare port**, from the image the old container used:

   ```bash
   set -a; . ./.env; set +a
   docker run -d --name athena-minio-old -p 127.0.0.1:9100:9000 \
     -e MINIO_ROOT_USER="$MINIO_ROOT_USER" -e MINIO_ROOT_PASSWORD="$MINIO_ROOT_PASSWORD" \
     -v athena_athena-minio:/data "$(docker inspect -f '{{.Image}}' athena-minio)" server /data
   ```

4. **Copy every object** (old → a scratch folder → new) and compare the totals:

   ```bash
   AWS="docker run --rm --network host -v /tmp/athena-s3:/work \
     -e AWS_ACCESS_KEY_ID=$MINIO_ROOT_USER -e AWS_SECRET_ACCESS_KEY=$MINIO_ROOT_PASSWORD \
     -e AWS_DEFAULT_REGION=us-east-1 amazon/aws-cli:2.38.5"
   $AWS --endpoint-url http://127.0.0.1:9100 s3 sync "s3://$MINIO_BUCKET" /work
   $AWS --endpoint-url http://127.0.0.1:${MINIO_PORT:-9000} s3 sync /work "s3://$MINIO_BUCKET"
   $AWS --endpoint-url http://127.0.0.1:9100 s3 ls "s3://$MINIO_BUCKET" --recursive --summarize | tail -2
   $AWS --endpoint-url http://127.0.0.1:${MINIO_PORT:-9000} s3 ls "s3://$MINIO_BUCKET" --recursive --summarize | tail -2
   ```

   The two `Total Objects` / `Total Size` lines must match.

5. **Update Settings → Storage** with the pair from `./minio-credentials.sh`,
   click *Test connection*, and open an artifact or guide image to check.

6. **Clean up** once you're satisfied:

   ```bash
   docker rm -f athena-minio-old athena-minio
   rm -rf /tmp/athena-s3
   # Later, when you no longer need a fallback:
   # docker volume rm athena_athena-minio
   ```

If the old MinIO image is gone from the host (`docker image ls minio/minio`
is empty and no `athena-minio` container exists), the data in the
`athena_athena-minio` volume can only be read with a MinIO binary; ask before
removing that volume.
