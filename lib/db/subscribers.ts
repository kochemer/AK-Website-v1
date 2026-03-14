/**
 * Repository for subscriber records.
 * All functions are server-only (never imported by client components).
 *
 * The "unique when present" email rule is enforced by the DB UNIQUE constraint on
 * the email column. NULL values are treated as distinct by PostgreSQL, so rows
 * without an email (e.g. Stripe webhook creates before sign-up) are allowed.
 */

import { eq, and, isNotNull } from 'drizzle-orm';
import { getDb } from './index';
import { subscribers } from './schema';
import type { Subscriber, NewSubscriber } from './schema';

// ── Helpers ───────────────────────────────────────────────────────────────────

function now() {
  return new Date();
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getSubscriberByEmail(
  email: string,
): Promise<Subscriber | null> {
  const rows = await getDb()
    .select()
    .from(subscribers)
    .where(eq(subscribers.email, email.toLowerCase().trim()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSubscriberByStripeCustomerId(
  stripeCustomerId: string,
): Promise<Subscriber | null> {
  const rows = await getDb()
    .select()
    .from(subscribers)
    .where(eq(subscribers.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return rows[0] ?? null;
}

/** Returns all subscribers who have opted in to the weekly email digest. */
export async function getWeeklyDigestRecipients(): Promise<Subscriber[]> {
  return getDb()
    .select()
    .from(subscribers)
    .where(
      and(
        eq(subscribers.emailDigestEnabled, true),
        isNotNull(subscribers.email),
      ),
    );
}

// ── Write ─────────────────────────────────────────────────────────────────────

/** Insert a new subscriber. Throws on duplicate email. */
export async function createSubscriber(
  data: Omit<NewSubscriber, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Subscriber> {
  const email = data.email ? data.email.toLowerCase().trim() : data.email;
  const rows = await getDb()
    .insert(subscribers)
    .values({ ...data, email, createdAt: now(), updatedAt: now() })
    .returning();
  return rows[0]!;
}

/**
 * Insert-or-update by email address.
 * On conflict, merges only the supplied fields (does not clear unrelated fields).
 */
export async function upsertSubscriberByEmail(
  email: string,
  data: Partial<Omit<NewSubscriber, 'id' | 'email' | 'createdAt' | 'updatedAt'>>,
): Promise<Subscriber> {
  const normalised = email.toLowerCase().trim();
  const rows = await getDb()
    .insert(subscribers)
    .values({ email: normalised, ...data, createdAt: now(), updatedAt: now() })
    .onConflictDoUpdate({
      target: subscribers.email,
      set:    { ...data, updatedAt: now() },
    })
    .returning();
  return rows[0]!;
}

export async function updateSubscriberPlan(
  email: string,
  planType: Subscriber['planType'],
  paymentStatus?: Subscriber['paymentStatus'],
): Promise<Subscriber | null> {
  const rows = await getDb()
    .update(subscribers)
    .set({ planType, paymentStatus: paymentStatus ?? null, updatedAt: now() })
    .where(eq(subscribers.email, email.toLowerCase().trim()))
    .returning();
  return rows[0] ?? null;
}

export async function updateSubscriberStripeInfo(
  email: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  paymentStatus: Subscriber['paymentStatus'],
): Promise<Subscriber | null> {
  const rows = await getDb()
    .update(subscribers)
    .set({ stripeCustomerId, stripeSubscriptionId, paymentStatus, updatedAt: now() })
    .where(eq(subscribers.email, email.toLowerCase().trim()))
    .returning();
  return rows[0] ?? null;
}

export async function setEmailDigestEnabled(
  email: string,
  enabled: boolean,
): Promise<Subscriber | null> {
  const rows = await getDb()
    .update(subscribers)
    .set({ emailDigestEnabled: enabled, updatedAt: now() })
    .where(eq(subscribers.email, email.toLowerCase().trim()))
    .returning();
  return rows[0] ?? null;
}

/**
 * Update a subscriber located by their Stripe customer ID.
 * Used primarily by webhook handlers where we have the Stripe customer ID
 * but may not have the email readily available.
 * Returns null if no subscriber with that stripeCustomerId exists.
 */
export async function updateSubscriberByStripeCustomerId(
  stripeCustomerId: string,
  data: Partial<Omit<NewSubscriber, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Subscriber | null> {
  const rows = await getDb()
    .update(subscribers)
    .set({ ...data, updatedAt: now() })
    .where(eq(subscribers.stripeCustomerId, stripeCustomerId))
    .returning();
  return rows[0] ?? null;
}
