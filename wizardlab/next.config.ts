import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbo: false,
    optimizeCss: false,
  },
};

export default nextConfig;
