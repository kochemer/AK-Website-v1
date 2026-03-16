/**
 * Simple sliding-window rate limiter backed by Vercel KV.
 * Falls open (allows the request) if KV is unavailable.
 *
 * Usage:
 *   const { allowed } = await checkRateLimit(ip, 'subscribe', 5, 900);
 *   if (!allowed) return 429;
 */

let kv: any = null;
try {
  const kvModule = require('@vercel/kv');
  kv = kvModule.kv;
} catch {
  // @vercel/kv not available — rate limiting disabled
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * @param identifier  Per-client key, typically the IP address
 * @param namespace   Logical bucket name, e.g. 'subscribe:free'
 * @param limit       Max requests allowed per window
 * @param windowSecs  Window length in seconds
 */
export async function checkRateLimit(
  identifier: string,
  namespace: string,
  limit: number,
  windowSecs: number,
): Promise<RateLimitResult> {
  if (!kv) {
    return { allowed: true, remaining: limit };
  }

  const window = Math.floor(Date.now() / (windowSecs * 1000));
  const key = `rate:${namespace}:${identifier}:${window}`;

  try {
    const count: number = await kv.incr(key);
    if (count === 1) {
      // First hit in this window — set TTL with a small buffer
      await kv.expire(key, windowSecs + 10);
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
    };
  } catch {
    // KV error — fail open rather than blocking legitimate users
    return { allowed: true, remaining: limit };
  }
}

/** Extract the real client IP from Next.js request headers. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return 'unknown';
}
