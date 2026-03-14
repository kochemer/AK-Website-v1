/**
 * Stripe server-side utilities.
 * Server-only — never import this from client components.
 */

import Stripe from 'stripe';

// ── Singleton client ──────────────────────────────────────────────────────────

let _stripe: Stripe | undefined;

/** Returns the shared Stripe instance, initialised lazily on first call. */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('[stripe] STRIPE_SECRET_KEY environment variable is not set');
    _stripe = new Stripe(key, { apiVersion: '2026-02-25.clover' });
  }
  return _stripe;
}

// ── Price ID ↔ plan_type helpers ──────────────────────────────────────────────

/** Returns the Stripe Price ID for a given internal plan_type. */
export function getPriceId(plan: 'supporter_monthly' | 'patron_monthly'): string {
  const priceId =
    plan === 'supporter_monthly'
      ? process.env.STRIPE_PRICE_SUPPORTER_MONTHLY
      : process.env.STRIPE_PRICE_PATRON_MONTHLY;

  if (!priceId) {
    throw new Error(
      `[stripe] Missing price ID for plan "${plan}". ` +
        `Set STRIPE_PRICE_SUPPORTER_MONTHLY or STRIPE_PRICE_PATRON_MONTHLY in your environment.`,
    );
  }
  return priceId;
}

/**
 * Maps a Stripe Price ID back to our plan_type.
 * Returns null for unrecognised price IDs (e.g. one-time add-ons, discounts).
 */
export function planFromPriceId(priceId: string): 'supporter_monthly' | 'patron_monthly' | null {
  if (priceId === process.env.STRIPE_PRICE_SUPPORTER_MONTHLY) return 'supporter_monthly';
  if (priceId === process.env.STRIPE_PRICE_PATRON_MONTHLY)    return 'patron_monthly';
  return null;
}

/**
 * Maps a Stripe subscription status to emailDigestEnabled.
 * Returns undefined for statuses where we should not change the current value (grace period).
 */
export function digestEnabledForStatus(status: string): boolean | undefined {
  if (['active', 'trialing'].includes(status)) return true;
  if (['canceled', 'unpaid'].includes(status)) return false;
  // past_due / incomplete: leave unchanged — give subscriber a grace period
  return undefined;
}
