# Athena app + workers image. Used by the `app` and `workers` compose services.

# Stage 1: the Labs agent (zaio), served by the app at /agent/. Static Go
# binaries for every CPU students' VMs may have.
FROM golang:1.27-bookworm AS agent
WORKDIR /agent
COPY agent/ .
RUN VERSION="$(cat VERSION)" && for arch in amd64 arm64; do \
      GOOS=linux GOARCH=$arch CGO_ENABLED=0 \
        go build -trimpath -ldflags "-s -w -X main.version=$VERSION" -o dist/zaio-linux-$arch ./cmd/zaio; \
    done

# Stage 2: the app. Installs all deps (build needs Tailwind/TS; workers need
# tsx + the Prisma CLI, which are runtime deps), generates the client, builds.
FROM node:22-bookworm-slim

WORKDIR /app

# openssl/ca-certificates for TLS + Prisma; curl for container tooling.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY . .

# Placeholder so `next build` (which loads src/lib/db.ts) doesn't fail on a
# missing DATABASE_URL. The real value is injected at runtime by docker-compose.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"
RUN npm ci && npm run build

# Agent binaries from stage 1, packaged as .debs, plus checksums/manifest for /agent/install.sh.
COPY --from=agent /agent/dist/ agent/dist/
RUN node scripts/build-agent.mjs --package-only

ENV NODE_ENV=production
EXPOSE 3000

# Overridden by the `workers` service to run pm2-runtime; the app service uses this.
CMD ["npm", "run", "start"]
