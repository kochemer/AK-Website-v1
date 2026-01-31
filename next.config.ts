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

// DEBUG — can be removed later
// Log PWA configuration status at build time
const isPwaEnabled = process.env.NODE_ENV !== "development";
console.log('[PWA DEBUG] next-pwa status:', {
  enabled: isPwaEnabled,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV || 'not-set',
  dest: 'public',
  swFilename: 'sw.js',
  swScope: '/',
  manifestPath: '/manifest.webmanifest',
});

// DEBUG — Verify VAPID key is present at build time
if (process.env.NODE_ENV === 'production') {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (vapidKey) {
    console.log('[BUILD DEBUG] NEXT_PUBLIC_VAPID_PUBLIC_KEY is set (length:', vapidKey.length, ')');
    console.log('[BUILD DEBUG] VAPID key prefix:', vapidKey.substring(0, 30) + '...');
  } else {
    console.warn('[BUILD DEBUG] ⚠️ NEXT_PUBLIC_VAPID_PUBLIC_KEY is NOT set in production build!');
    console.warn('[BUILD DEBUG] This will cause push notifications to fail.');
  }
}

export default pwaConfig(nextConfig);
