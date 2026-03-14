import { NextResponse } from 'next/server';
import { upsertSubscriberByEmail } from '@/lib/db/subscribers';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    // No email supplied → acknowledge without touching the DB.
    // The digest remains publicly accessible at the site; no record is needed.
    if (!email) {
      return NextResponse.json({ ok: true, withDigest: false });
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, error: 'Please enter a valid email address.' },
        { status: 400 },
      );
    }

    await upsertSubscriberByEmail(email, {
      planType: 'free',
      emailDigestEnabled: true,
    });

    return NextResponse.json({ ok: true, withDigest: true });
  } catch (err) {
    console.error('[api/subscribe/free]', err);
    return NextResponse.json(
      { ok: false, error: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
