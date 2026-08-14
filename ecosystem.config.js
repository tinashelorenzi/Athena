// PM2 process definitions for Athena: the web app + the realtime feed service.
//
//   npm run build                      # build first (web runs `next start`)
//   pm2 start ecosystem.config.js      # start athena-web + soc-realtime
//   pm2 status
//   pm2 logs soc-realtime              # tail the WebSocket service
//   pm2 delete ecosystem.config.js     # stop them
//
// (If you're upgrading from the old workers: `pm2 delete soc-master1 soc-master2`.)
//
// athena-web listens on PORT (default 3000). soc-realtime is a WebSocket server
// on SOC_REALTIME_PORT (default 3002) — proxy `/ws` to it in nginx. Env
// (DATABASE_URL etc.) is loaded from .env by Next and by the service itself.
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
    {
      name: "soc-realtime",
      script: "scripts/soc-realtime.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      autorestart: true,
      max_restarts: 20,
      env: { NODE_ENV: "production", SOC_REALTIME_PORT: process.env.SOC_REALTIME_PORT || "3002" },
    },
  ],
};
