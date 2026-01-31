import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
  // Redirects removed - handle www to non-www redirect at Vercel platform level
  // to avoid conflicts and redirect loops
  // Configure in Vercel Dashboard: Project Settings > Domains > Redirects
  // Use webpack explicitly for next-pwa compatibility (next-pwa requires webpack)
  webpack: (config, { isServer }) => {
    return config;
  },
  // Empty turbopack config to silence Next.js 16 warning (we use webpack for next-pwa)
  turbopack: {},
};

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Import push-sw.js to add Web Push event handlers
  importScripts: ["/push-sw.js"],
  // Keep existing runtime caching and fallback configuration
  // (next-pwa will use defaults if not specified)
});

export default pwaConfig(nextConfig);
