import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables the `unauthorized()` (401) and `forbidden()` (403) navigation
  // interrupts + their unauthorized.jsx / forbidden.jsx UI files.
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
