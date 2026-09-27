import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden() for permission denials.
    authInterrupts: true,
  },
};

export default nextConfig;
