import { NextResponse } from 'next/server';
import { verifyUnsubscribeToken } from '@/lib/utils/unsubscribeToken';
import { setEmailDigestEnabled, getSubscriberByEmail } from '@/lib/db/subscribers';
import { getSiteUrl } from '@/lib/utils/siteUrl';

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Luxury Intelligence</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; background: #FAF9F6; color: #1A1A1A;
           max-width: 480px; margin: 80px auto; padding: 24px 32px; }
    h1   { font-size: 1.4rem; font-weight: normal; color: #1B2A4A; margin: 0 0 16px; }
    p    { font-size: 0.95rem; line-height: 1.7; color: #6B7280; margin: 0 0 12px; }
    a    { color: #8B6914; }
    .mono { font-family: 'Courier New', monospace; font-size: 0.8rem;
            letter-spacing: 0.1em; text-transform: uppercase; color: #8B6914; }
  </style>
</head>
<body>
  <p class="mono">Luxury Intelligence</p>
  ${body}
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw   = searchParams.get('email') ?? '';
  const token = searchParams.get('token') ?? '';
  const email = raw.toLowerCase().trim();

  if (!email || !token) {
    return NextResponse.json({ error: 'Missing email or token.' }, { status: 400 });
  }

  if (!verifyUnsubscribeToken(email, token)) {
    return htmlPage(
      'Invalid link',
      `<h1>Invalid unsubscribe link</h1>
       <p>This link is invalid or has already been used. If you need to unsubscribe, please <a href="${getSiteUrl()}/feedback">contact us</a>.</p>`,
    );
  }

  // Check if already unsubscribed — idempotent
  const existing = await getSubscriberByEmail(email);
  if (existing && !existing.emailDigestEnabled) {
    return htmlPage(
      'Already unsubscribed',
      `<h1>Already unsubscribed</h1>
       <p><strong>${escapeHtml(email)}</strong> is not currently receiving the weekly digest.</p>
       <p>You can <a href="${getSiteUrl()}/subscribe">re-subscribe</a> at any time.</p>`,
    );
  }

  try {
    await setEmailDigestEnabled(email, false);
    console.log(`[unsubscribe] disabled digest for ${email}`);
  } catch (err) {
    console.error('[unsubscribe] DB error:', err);
    return NextResponse.json({ error: 'Failed to unsubscribe. Please try again.' }, { status: 500 });
  }

  return htmlPage(
    'Unsubscribed',
    `<h1>You&rsquo;ve been unsubscribed</h1>
     <p><strong>${escapeHtml(email)}</strong> has been removed from the weekly digest.</p>
     <p>You can <a href="${getSiteUrl()}/subscribe">re-subscribe</a> at any time.</p>`,
  );
}
