import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// ── Enums ─────────────────────────────────────────────────────────────────────

/** Subscription tier. "none" = unsubscribed / pre-payment. */
export const planTypeEnum = pgEnum('plan_type', [
  'none',
  'free',
  'supporter_monthly',
  'patron_monthly',
]);

/** Mirrors Stripe subscription statuses. */
export const paymentStatusEnum = pgEnum('payment_status', [
  'active',
  'canceled',
  'past_due',
  'incomplete',
  'unpaid',
  'trialing',
]);

// ── Table ─────────────────────────────────────────────────────────────────────

export const subscribers = pgTable('subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Nullable at the DB level; the UNIQUE index allows multiple NULLs (SQL standard).
  // Application layer should always validate format before writing.
  email: text('email').unique(),

  planType: planTypeEnum('plan_type').notNull().default('none'),

  // Whether this person should receive the weekly email digest.
  // Kept separate from plan_type so free subscribers can opt in/out independently.
  emailDigestEnabled: boolean('email_digest_enabled').notNull().default(false),

  // Stripe fields — populated by webhook handler (Step 3).
  stripeCustomerId:     text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  paymentStatus:        paymentStatusEnum('payment_status'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Inferred TypeScript types ─────────────────────────────────────────────────

export type Subscriber    = typeof subscribers.$inferSelect;
export type NewSubscriber = typeof subscribers.$inferInsert;
