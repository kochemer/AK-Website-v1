/**
 * Stripe webhook handler.
 *
 * Stripe sends signed POST requests to this endpoint for subscription lifecycle events.
 * We verify the signature, then upsert/update the subscriber row in our DB.
 *
 * All operations are idempotent — safe for Stripe's at-least-once delivery.
 */

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, planFromPriceId, digestEnabledForStatus } from '@/lib/stripe';
import {
  upsertSubscriberByEmail,
  getSubscriberByEmail,
  getSubscriberByStripeCustomerId,
  updateSubscriberByStripeCustomerId,
} from '@/lib/db/subscribers';
import { sendPaidConfirmationEmail } from '@/lib/email/transactional';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve the subscriber email for a given Stripe customer ID.
 * Checks our DB first (fast path), then falls back to the Stripe API.
 */
async function resolveEmail(stripeCustomerId: string): Promise<string | null> {
  const existing = await getSubscriberByStripeCustomerId(stripeCustomerId);
  if (existing?.email) return existing.email;

  // Fallback: retrieve customer from Stripe (e.g. event arrived out of order)
  const customer = await getStripe().customers.retrieve(stripeCustomerId);
  if (customer.deleted) return null;
  return (customer as Stripe.Customer).email?.toLowerCase().trim() ?? null;
}

/** Extracts the first active price ID from a subscription's line items. */
function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  return sub.items.data[0]?.price.id ?? null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const sig    = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    console.warn('[webhook] Missing stripe-signature header or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook configuration error' }, { status: 400 });
  }

  // Must use raw body string for signature verification — not parsed JSON.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.warn('[webhook] Signature verification failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const { type } = event;
  console.log(`[webhook] ${type} id=${event.id}`);

  try {
    switch (type) {

      // ── A checkout session completed successfully ────────────────────────
      // This is the primary event for initial subscription creation.
      // The session carries customer email + Stripe IDs + our plan metadata.
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const email =
          (session.customer_details?.email ?? session.customer_email ?? '')
            .toLowerCase()
            .trim();

        if (!email) {
          console.warn(`[webhook] checkout.session.completed: no email on session=${session.id}`);
          break;
        }

        const stripeCustomerId     = typeof session.customer     === 'string' ? session.customer     : null;
        const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
        const planType             = session.metadata?.plan_type as 'supporter_monthly' | 'patron_monthly' | undefined;

        if (!planType || !['supporter_monthly', 'patron_monthly'].includes(planType)) {
          console.warn(`[webhook] checkout.session.completed: unrecognised plan_type="${planType}" session=${session.id}`);
          break;
        }

        // Check state before upserting to decide whether this is a fresh activation.
        // If Stripe retries this event and the row is already active on the same plan,
        // we skip the confirmation email to prevent duplicates.
        const beforePaid = await getSubscriberByEmail(email);
        const isNewActivation =
          !beforePaid ||
          beforePaid.planType !== planType ||
          beforePaid.paymentStatus !== 'active';

        await upsertSubscriberByEmail(email, {
          planType,
          paymentStatus:        'active',
          emailDigestEnabled:   true,
          ...(stripeCustomerId     && { stripeCustomerId }),
          ...(stripeSubscriptionId && { stripeSubscriptionId }),
        });

        console.log(`[webhook] checkout.session.completed: subscribed customer=${stripeCustomerId} plan=${planType}`);

        if (isNewActivation) {
          sendPaidConfirmationEmail(email, planType).catch(err =>
            console.error('[webhook] paid confirmation email failed:', err),
          );
        }
        break;
      }

      // ── Subscription created ─────────────────────────────────────────────
      // Usually fires after checkout.session.completed. We use it as a safety
      // net to ensure the Stripe IDs are stored even if event order varies.
      case 'customer.subscription.created': {
        const sub               = event.data.object as Stripe.Subscription;
        const stripeCustomerId  = typeof sub.customer === 'string' ? sub.customer : null;

        if (!stripeCustomerId) break;

        const email = await resolveEmail(stripeCustomerId);
        if (!email) {
          console.warn(`[webhook] subscription.created: could not resolve email for customer=${stripeCustomerId}`);
          break;
        }

        const priceId  = priceIdFromSubscription(sub);
        const planType = priceId ? planFromPriceId(priceId) : null;
        const digestEnabled = digestEnabledForStatus(sub.status);

        await upsertSubscriberByEmail(email, {
          stripeCustomerId,
          stripeSubscriptionId: sub.id,
          ...(planType                    && { planType }),
          ...(sub.status                  && { paymentStatus: sub.status as 'active' | 'trialing' | 'past_due' | 'incomplete' | 'unpaid' | 'canceled' }),
          ...(digestEnabled !== undefined && { emailDigestEnabled: digestEnabled }),
        });

        console.log(`[webhook] subscription.created: sub=${sub.id} customer=${stripeCustomerId} status=${sub.status}`);
        break;
      }

      // ── Subscription updated ─────────────────────────────────────────────
      // Fires on plan changes, renewal cycles, and status transitions.
      case 'customer.subscription.updated': {
        const sub              = event.data.object as Stripe.Subscription;
        const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : null;

        if (!stripeCustomerId) break;

        const priceId       = priceIdFromSubscription(sub);
        const planType      = priceId ? planFromPriceId(priceId) : null;
        const digestEnabled = digestEnabledForStatus(sub.status);

        const updateData: Parameters<typeof updateSubscriberByStripeCustomerId>[1] = {
          stripeSubscriptionId: sub.id,
          paymentStatus: sub.status as 'active' | 'trialing' | 'past_due' | 'incomplete' | 'unpaid' | 'canceled',
          ...(planType                    && { planType }),
          ...(digestEnabled !== undefined && { emailDigestEnabled: digestEnabled }),
        };

        const updated = await updateSubscriberByStripeCustomerId(stripeCustomerId, updateData);

        if (!updated) {
          // Row missing — try to create it from the Stripe customer record
          const email = await resolveEmail(stripeCustomerId);
          if (email && planType) {
            await upsertSubscriberByEmail(email, {
              stripeCustomerId,
              stripeSubscriptionId: sub.id,
              planType,
              paymentStatus: sub.status as 'active' | 'trialing' | 'past_due' | 'incomplete' | 'unpaid' | 'canceled',
              ...(digestEnabled !== undefined && { emailDigestEnabled: digestEnabled }),
            });
          }
        }

        console.log(`[webhook] subscription.updated: sub=${sub.id} status=${sub.status} plan=${planType ?? 'unknown'}`);
        break;
      }

      // ── Subscription deleted / cancelled ─────────────────────────────────
      // Fires when a subscription ends (cancellation or non-payment).
      case 'customer.subscription.deleted': {
        const sub              = event.data.object as Stripe.Subscription;
        const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : null;

        if (!stripeCustomerId) break;

        await updateSubscriberByStripeCustomerId(stripeCustomerId, {
          planType:           'none',
          paymentStatus:      'canceled',
          emailDigestEnabled: false,
        });

        console.log(`[webhook] subscription.deleted: sub=${sub.id} customer=${stripeCustomerId}`);
        break;
      }

      // ── Invoice paid ─────────────────────────────────────────────────────
      // Fires on successful renewal. Ensures the subscriber stays active.
      case 'invoice.paid': {
        const invoice          = event.data.object as Stripe.Invoice;
        const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : null;

        if (!stripeCustomerId) break;

        await updateSubscriberByStripeCustomerId(stripeCustomerId, {
          paymentStatus:      'active',
          emailDigestEnabled: true,
        });

        console.log(`[webhook] invoice.paid: customer=${stripeCustomerId}`);
        break;
      }

      // ── Invoice payment failed ────────────────────────────────────────────
      // Fires on a failed charge attempt. Mark as past_due but keep the digest
      // enabled — Stripe will retry and we give the subscriber a grace period.
      case 'invoice.payment_failed': {
        const invoice          = event.data.object as Stripe.Invoice;
        const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : null;

        if (!stripeCustomerId) break;

        await updateSubscriberByStripeCustomerId(stripeCustomerId, {
          paymentStatus: 'past_due',
          // emailDigestEnabled intentionally not changed — grace period
        });

        console.log(`[webhook] invoice.payment_failed: customer=${stripeCustomerId}`);
        break;
      }

      default:
        // Unhandled event type — return 200 so Stripe doesn't retry it
        break;
    }
  } catch (err) {
    // Return 500 so Stripe retries the delivery
    console.error(`[webhook] Error processing ${type}:`, err);
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
