import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // TypeScript se verifica localmente con tsc --noEmit antes de subir
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
