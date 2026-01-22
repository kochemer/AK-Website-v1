import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure dev server binds to all interfaces
  ...(process.env.NODE_ENV === 'development' && {
    // Development-specific config
  }),
};

export default nextConfig;
