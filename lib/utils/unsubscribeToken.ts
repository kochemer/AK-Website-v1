/**
 * Unsubscribe token utilities.
 *
 * Tokens are deterministic HMAC-SHA256 signatures, so they can be regenerated
 * and embedded in each outgoing email without storing anything in the DB.
 *
 * Security: without knowing UNSUBSCRIBE_SECRET, an attacker cannot forge a
 * valid token for an email address they don't own.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { getSiteUrl } from './siteUrl';

function getSecret(): string | null {
  return process.env.UNSUBSCRIBE_SECRET ?? null;
}

/** Returns a 32-character hex token for the given email, or null if secret is not configured. */
export function generateUnsubscribeToken(email: string): string | null {
  const secret = getSecret();
  if (!secret) {
    console.warn('[unsubscribeToken] UNSUBSCRIBE_SECRET is not set — token generation skipped');
    return null;
  }
  return createHmac('sha256', secret)
    .update(email.toLowerCase().trim())
    .digest('hex')
    .slice(0, 32);
}

/** Constant-time comparison — returns false if secret is not configured. */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const secret = getSecret();
  if (!secret || !token) {
    console.warn('[unsubscribeToken] UNSUBSCRIBE_SECRET is not set — token verification failed');
    return false;
  }
  const expected = createHmac('sha256', secret)
    .update(email.toLowerCase().trim())
    .digest('hex')
    .slice(0, 32);
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

/**
 * Builds the full unsubscribe URL to embed in outgoing emails.
 * Falls back to /subscribe if UNSUBSCRIBE_SECRET is not configured,
 * so confirmation emails still send rather than throwing.
 */
export function buildUnsubscribeUrl(email: string, siteUrl?: string): string {
  const base  = siteUrl ?? getSiteUrl();
  const token = generateUnsubscribeToken(email);
  if (!token) {
    // Graceful fallback: link to subscribe page rather than crashing the email send
    return `${base}/subscribe`;
  }
  return `${base}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}
