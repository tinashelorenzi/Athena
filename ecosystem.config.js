// PM2 process definitions for Athena: the web app + the two scenario feed workers.
//
//   npm run build                      # build first (web runs `next start`)
//   pm2 start ecosystem.config.js      # start athena-web + soc-master1 + soc-master2
//   pm2 status                         # see all three
//   pm2 logs athena-web                # tail the web app
//   pm2 delete ecosystem.config.js     # stop them
//
// The web app listens on PORT (default 3000). Workers are sharded by run id via
// SOC_WORKER_INDEX/COUNT. Env (DATABASE_URL etc.) is loaded from .env by Next
// and by the workers themselves — PM2 doesn't need to inject it.
const worker = {
  script: "scripts/soc-master.ts",
  interpreter: "node",
  interpreter_args: "--import tsx",
  autorestart: true,
  max_restarts: 20,
  env: { SOC_WORKER_COUNT: "2", SOC_TICK_MS: "3000" },
};

module.exports = {
  apps: [
    {
      name: "athena-web",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      interpreter: "node",
      autorestart: true,
      max_restarts: 20,
      env: { NODE_ENV: "production", PORT: process.env.PORT || "3000" },
    },
    { ...worker, name: "soc-master1", env: { ...worker.env, SOC_WORKER_INDEX: "0" } },
    { ...worker, name: "soc-master2", env: { ...worker.env, SOC_WORKER_INDEX: "1" } },
  ],
};
