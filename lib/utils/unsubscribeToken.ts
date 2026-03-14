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

function getSecret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (!s) throw new Error('[unsubscribeToken] UNSUBSCRIBE_SECRET environment variable is not set');
  return s;
}

/** Returns a 32-character hex token for the given email. */
export function generateUnsubscribeToken(email: string): string {
  return createHmac('sha256', getSecret())
    .update(email.toLowerCase().trim())
    .digest('hex')
    .slice(0, 32);
}

/** Constant-time comparison — prevents timing attacks. */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  if (!token) return false;
  const expected = generateUnsubscribeToken(email);
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

/** Builds the full unsubscribe URL to embed in outgoing emails. */
export function buildUnsubscribeUrl(email: string, siteUrl?: string): string {
  const base = siteUrl ?? getSiteUrl();
  const token = generateUnsubscribeToken(email);
  return `${base}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}
