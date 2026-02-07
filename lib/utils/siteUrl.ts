/**
 * Get the canonical site URL for the current environment.
 * 
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL environment variable (explicit override)
 * 2. Request hostname (if available in server context)
 * 3. Production fallback to luxury-intel.com (custom domain)
 * 4. Development fallback to localhost
 * 
 * This ensures the custom domain is used by default in production,
 * even if NEXT_PUBLIC_SITE_URL is not set.
 */

export function getSiteUrl(): string {
  // Explicit override (highest priority)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  // In production, default to custom domain (not vercel.app)
  if (process.env.NODE_ENV === 'production') {
    // Default to custom domain in production
    return 'https://luxury-intel.com';
  }

  // Development fallback
  return 'http://localhost:3000';
}

/**
 * Get site URL from request headers (for server components that can access headers).
 * This allows the site to work correctly on both custom domain and vercel.app
 * without requiring environment variable changes.
 */
export function getSiteUrlFromHeaders(host?: string | null): string {
  // Explicit override (highest priority)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  // Use request hostname if available
  if (host) {
    // Normalize to https
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    return `${protocol}://${host}`;
  }

  // Fallback to getSiteUrl()
  return getSiteUrl();
}
