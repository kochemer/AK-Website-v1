/**
 * Amplitude user identity helpers.
 *
 * Rules:
 * - Never send raw email to Amplitude — always SHA-256 hash it first.
 * - Call identifySubscriber() as soon as we know who the user is (subscribe success / checkout start).
 * - setUserPlan() can be called independently when only the plan is known (e.g. checkout_complete).
 */

import { identify, setUserId } from '@amplitude/unified';
import { Identify } from '@amplitude/analytics-browser';

/**
 * SHA-256 hash an email address using the Web Crypto API.
 * Returns a lowercase hex string. Returns null if crypto is unavailable.
 */
async function hashEmail(email: string): Promise<string | null> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(email.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/**
 * Identify a subscriber in Amplitude.
 * Sets the user ID (hashed email) and plan_type user property.
 * Safe to call multiple times — Amplitude deduplicates on its end.
 */
export async function identifySubscriber(email: string, planType: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const userId = await hashEmail(email);
    if (userId) {
      setUserId(userId);
    }
    const identifyEvent = new Identify();
    identifyEvent.set('plan_type', planType);
    identify(identifyEvent);
  } catch {
    // Non-critical — never block subscribe flow
  }
}

/**
 * Set or update plan_type user property without changing user ID.
 * Used on checkout_complete when we have a plan but not the email.
 */
export function setUserPlan(planType: string): void {
  if (typeof window === 'undefined') return;
  try {
    const identifyEvent = new Identify();
    identifyEvent.set('plan_type', planType);
    identify(identifyEvent);
  } catch {
    // Non-critical
  }
}
