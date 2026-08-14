# Athena app + workers image. Used by the `app` and `workers` compose services.
# Single stage: installs all deps (build needs Tailwind/TS; workers need tsx +
# the Prisma CLI, which are runtime deps), generates the client, and builds.
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

ENV NODE_ENV=production
EXPOSE 3000

# Overridden by the `workers` service to run pm2-runtime; the app service uses this.
CMD ["npm", "run", "start"]
