import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables the `unauthorized()` (401) and `forbidden()` (403) navigation
    // interrupts + their unauthorized.jsx / forbidden.jsx UI files.
    authInterrupts: true,
    // Scenario autobuild / guide-folder / artifact uploads are Server Actions,
    // which default to a 1MB body cap. Raise it so full bundles (guide images +
    // evidence artifacts) upload. Keep nginx's client_max_body_size >= this.
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
