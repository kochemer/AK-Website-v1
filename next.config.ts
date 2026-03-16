import type { NextConfig } from "next";
import withPWA from "next-pwa";
import { promises as fs } from 'fs';
import path from 'path';
import { weekLabelToSlug } from './lib/utils/weekSlug';

/**
 * Generate 308 permanent redirects for all known /week/YYYY-Www → /digest/slug.
 * Evaluated at build time. Future weeks (added after deployment) are handled
 * by the server-side permanentRedirect in app/week/[weekLabel]/page.tsx.
 */
async function buildWeekRedirects() {
  try {
    const digestsDir = path.join(process.cwd(), 'data', 'digests');
    const files      = await fs.readdir(digestsDir);
    const weekLabels = files
      .filter(f => /^\d{4}-W\d{1,2}\.json$/.test(f))
      .map(f => f.replace('.json', ''));

    return weekLabels.map(weekLabel => ({
      source:      `/week/${weekLabel}`,
      destination: `/digest/${weekLabelToSlug(weekLabel)}`,
      permanent:   true,
    }));
  } catch {
    return [];
  }
}

const securityHeaders = [
  // Prevent the site being embedded in iframes (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop browsers guessing content types (MIME sniffing attacks)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Force HTTPS for 2 years, include subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Limit referrer info sent to third parties
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable unused browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // Permanent 308 redirects: /week/YYYY-Www → /digest/month-yyyy-week-n
  redirects: buildWeekRedirects,
  // Security headers applied to all routes
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
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
