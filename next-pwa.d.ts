declare module "next-pwa" {
  import type { NextConfig } from "next";
  
  interface PWAConfig {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    buildExcludes?: RegExp[];
    fallbacks?: {
      document?: string;
    };
    runtimeCaching?: Array<{
      urlPattern: RegExp;
      handler: string;
      options?: {
        cacheName?: string;
        expiration?: {
          maxEntries?: number;
          maxAgeSeconds?: number;
        };
        networkTimeoutSeconds?: number;
        cacheableResponse?: {
          statuses?: number[];
        };
        matchOptions?: {
          ignoreSearch?: boolean;
          ignoreVary?: boolean;
        };
      };
    }>;
  }
  
  function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;
  export default withPWA;
}
