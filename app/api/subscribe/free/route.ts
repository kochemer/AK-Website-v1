import { NextResponse } from 'next/server';
import { upsertSubscriberByEmail, getSubscriberByEmail } from '@/lib/db/subscribers';
import { sendFreeConfirmationEmail } from '@/lib/email/transactional';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    // No email supplied → acknowledge without touching the DB.
    if (!email) {
      return NextResponse.json({ ok: true, withDigest: false });
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, error: 'Please enter a valid email address.' },
        { status: 400 },
      );
    }

    // Check current state before upserting so we can determine whether this is
    // a genuinely new free signup (and therefore needs a confirmation email).
    const before = await getSubscriberByEmail(email);
    const isNew  = !before || before.planType !== 'free';

    await upsertSubscriberByEmail(email, {
      planType:           'free',
      emailDigestEnabled: true,
    });

    // Send confirmation only on first-time free signup.
    // Re-submitting the same email a second time is silently idempotent (no duplicate email).
    if (isNew) {
      sendFreeConfirmationEmail(email).catch(err =>
        console.error('[api/subscribe/free] confirmation email failed:', err instanceof Error ? err.message : err),
      );
    }

    return NextResponse.json({ ok: true, withDigest: true });
  } catch (err) {
    console.error('[api/subscribe/free]', err);
    return NextResponse.json(
      { ok: false, error: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
