import { NextResponse } from 'next/server';
import { getStripe, getPriceId } from '@/lib/stripe';
import { upsertSubscriberByEmail } from '@/lib/db/subscribers';
import { getSiteUrl } from '@/lib/utils/siteUrl';

const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_PLANS = new Set<string>(['supporter_monthly', 'patron_monthly']);

export async function POST(req: Request) {
  try {
    const body  = (await req.json()) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const plan  = typeof body.plan  === 'string' ? body.plan  : '';

    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email is required.' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (!VALID_PLANS.has(plan)) {
      return NextResponse.json({ ok: false, error: 'Invalid plan.' }, { status: 400 });
    }

    const typedPlan = plan as 'supporter_monthly' | 'patron_monthly';
    const siteUrl   = getSiteUrl();

    // Reserve the subscriber row so the webhook has something to update.
    // planType stays 'none' until the webhook confirms payment.
    await upsertSubscriberByEmail(email, { planType: 'none' });

    const session = await getStripe().checkout.sessions.create({
      mode:           'subscription',
      customer_email: email,
      line_items: [{ price: getPriceId(typedPlan), quantity: 1 }],

      // Embed plan metadata on both the session and the subscription object
      // so webhook handlers can reliably identify the plan regardless of which
      // event arrives first.
      metadata: { email, plan_type: typedPlan },
      subscription_data: {
        metadata: { email, plan_type: typedPlan },
      },

      success_url: `${siteUrl}/subscribe?success=1&plan=${typedPlan}`,
      cancel_url:  `${siteUrl}/subscribe?canceled=1`,

      allow_promotion_codes: false,
    });

    console.log(`[subscribe/paid] session=${session.id} email=${email} plan=${typedPlan}`);

    return NextResponse.json({ ok: true, checkoutUrl: session.url });
  } catch (err) {
    console.error('[api/subscribe/paid]', err);
    return NextResponse.json(
      { ok: false, error: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
