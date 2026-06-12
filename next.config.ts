import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // This app lives inside the multi-repo `RideMates/` workspace, so Turbopack's
  // automatic workspace-root inference guesses wrong. Pin the root to this
  // project directory. See next.config.js → turbopack#root-directory.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
