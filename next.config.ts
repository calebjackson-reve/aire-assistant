import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["canvas", "sharp"],
  poweredByHeader: false,
};

export default nextConfig;
