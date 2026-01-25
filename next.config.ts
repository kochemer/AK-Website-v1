import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure dev server binds to all interfaces
  ...(process.env.NODE_ENV === 'development' && {
    // Development-specific config
  }),
  // Add empty turbopack config to silence warning when using --webpack flag
  turbopack: {},
};

// Apply PWA wrapper - it will be disabled in development via the disable flag
const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development", // Disable in development
  buildExcludes: [/app-manifest\.json$/],
  fallbacks: {
    document: "/offline.html",
  },
  runtimeCaching: [
    // Network-first for HTML/navigation requests (fallback to cache, then offline.html)
    {
      urlPattern: /^https?:\/\/.*\/.*$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "html-cache",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
        networkTimeoutSeconds: 10,
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // Cache-first for static assets (JS, CSS, fonts, images, icons)
    {
      urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
        matchOptions: {
          ignoreSearch: false,
          ignoreVary: true,
        },
      },
    },
  ],
});

export default pwaConfig(nextConfig);
