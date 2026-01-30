import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    // Only apply redirects in production (not in dev mode for performance)
    if (process.env.NODE_ENV !== 'production') {
      return [];
    }
    
    // Redirect www to non-www (or vice versa if preferred)
    // This ensures a single canonical domain
    // Change 'luxury-intel.com' to 'www.luxury-intel.com' if www is preferred
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.luxury-intel.com',
          },
        ],
        destination: 'https://luxury-intel.com/:path*',
        permanent: true, // 301 redirect
      },
    ];
  },
};

export default nextConfig;
