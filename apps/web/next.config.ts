import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows the smoke test to use a separate dev cache without disturbing the app.
  distDir: process.env.ANKA_WEB_DIST_DIR ?? ".next",
};

export default nextConfig;
