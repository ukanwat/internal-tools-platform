import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden() for permission denials.
    authInterrupts: true,
    // Room for a 10 MB attachment plus form fields.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
