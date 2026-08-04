// PM2 process definitions for the Athena scenario data-feed workers.
//   pm2 start ecosystem.config.js      # start soc-master1 + soc-master2
//   pm2 logs soc-master1               # tail one worker
//   pm2 delete ecosystem.config.js     # stop them
//
// Both run the same tsx worker; SOC_WORKER_INDEX/COUNT shard the runs between
// them. See docs/workers.md.
const base = {
  script: "scripts/soc-master.ts",
  interpreter: "node",
  interpreter_args: "--import tsx",
  autorestart: true,
  max_restarts: 20,
  env: { SOC_WORKER_COUNT: "2", SOC_TICK_MS: "3000" },
};

module.exports = {
  apps: [
    { ...base, name: "soc-master1", env: { ...base.env, SOC_WORKER_INDEX: "0" } },
    { ...base, name: "soc-master2", env: { ...base.env, SOC_WORKER_INDEX: "1" } },
  ],
};
