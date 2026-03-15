/**
 * Transactional confirmation emails for subscription events.
 *
 * Two variants:
 *   sendFreeConfirmationEmail  — fired after free signup with email
 *   sendPaidConfirmationEmail  — fired from Stripe webhook on first paid activation
 *
 * Both reuse the site's Resend account (RESEND_API_KEY / EMAIL_FROM) and the
 * existing HMAC-signed unsubscribe token approach.
 *
 * Duplicate-send prevention is caller-side:
 *   - Free: caller checks whether subscriber already has plan_type='free' before calling.
 *   - Paid: caller checks whether subscriber is already active on that plan before calling.
 * This avoids a DB schema change while staying safe against Stripe's at-least-once delivery.
 */

import { Resend } from 'resend';
import { escapeHtml } from '@/lib/digest/renderEmailDigestHtml';
import { buildUnsubscribeUrl } from '@/lib/utils/unsubscribeToken';

// Transactional emails always link to the canonical production domain.
// We do NOT use getSiteUrl() here because NEXT_PUBLIC_SITE_URL may be set to
// a Vercel preview URL on non-production deployments, which would embed the
// wrong link in emails sent to real users.
const CANONICAL_URL = 'https://luxury-intel.com';

// ── Brand palette (matches renderEmailDigestHtml) ────────────────────────────

const C = {
  bg:         '#FAF9F6',
  textPrimary:'#1A1A1A',
  textSecond: '#6B7280',
  accent:     '#8B6914',
  navy:       '#1B2A4A',
  navyFaint:  '#697386',
  border:     '#E5E7EB',
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS  = "'Helvetica Neue', Arial, Helvetica, sans-serif";

// ── HTML / plaintext renderers ────────────────────────────────────────────────

type ConfirmationContent = {
  subject:         string;
  headline:        string;
  bodyParagraphs:  string[];
  ctaLabel:        string;
  ctaUrl:          string;
  /** Shown in both body and footer. Omit for free plan. */
  footerNote?:     string;
  unsubscribeUrl:  string;
};

function renderHtml(c: ConfirmationContent): string {
  const siteUrl = CANONICAL_URL;
  const paragraphs = c.bodyParagraphs
    .map(p => `<p style="margin:0 0 16px 0; font-family:${SANS}; font-size:15px; line-height:1.75; color:${C.textSecond};">${p}</p>`)
    .join('\n              ');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(c.subject)}</title>
  <style>
    @media screen and (max-width:600px) {
      .pad { padding-left:20px !important; padding-right:20px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#EDE9E1; -webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EDE9E1;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%;">

          <!-- Masthead -->
          <tr>
            <td class="pad" style="background-color:${C.navy}; padding:28px 40px;">
              <a href="${escapeHtml(siteUrl)}" style="text-decoration:none;">
                <p style="margin:0 0 5px 0; font-family:${SANS}; font-size:9px; letter-spacing:0.3em; text-transform:uppercase; color:${C.accent};">Luxury Intelligence</p>
                <p style="margin:0; font-family:${SANS}; font-size:10px; color:${C.navyFaint}; letter-spacing:0.12em;">Weekly Intelligence Digest</p>
              </a>
            </td>
          </tr>
          <!-- Gold rule -->
          <tr><td style="height:3px; background-color:${C.accent};"></td></tr>

          <!-- Body -->
          <tr>
            <td class="pad" style="background-color:${C.bg}; padding:36px 40px 8px;">
              <h1 style="margin:0 0 24px 0; font-family:${SERIF}; font-size:24px; font-weight:normal; line-height:1.4; color:${C.textPrimary};">${escapeHtml(c.headline)}</h1>
              ${paragraphs}
              <!-- CTA -->
              <p style="margin:28px 0 0 0;">
                <a href="${escapeHtml(c.ctaUrl)}"
                   style="font-family:${SANS}; font-size:11px; letter-spacing:0.12em; text-transform:uppercase;
                          color:${C.accent}; text-decoration:none;
                          border:1px solid ${C.accent}; padding:10px 22px; display:inline-block;">
                  ${escapeHtml(c.ctaLabel)}
                </a>
              </p>
            </td>
          </tr>

          <!-- Bottom padding -->
          <tr><td style="background-color:${C.bg}; height:40px;"></td></tr>

          <!-- Footer -->
          <tr><td style="height:2px; background-color:${C.accent};"></td></tr>
          <tr>
            <td class="pad" style="background-color:${C.navy}; padding:24px 40px; text-align:center;">
              <p style="margin:0 0 10px 0; font-family:${SANS}; font-size:10px; color:${C.navyFaint}; line-height:1.75;">
                You are receiving this because you signed up at
                <a href="${escapeHtml(siteUrl)}" style="color:${C.navyFaint};">luxury-intel.com</a>.${c.footerNote ? `<br>${escapeHtml(c.footerNote)}` : ''}
              </p>
              <p style="margin:0; font-family:${SANS}; font-size:9px; color:${C.navyFaint};">
                <a href="${escapeHtml(c.unsubscribeUrl)}"
                   style="color:${C.navyFaint}; text-decoration:underline;">
                  Unsubscribe from digest emails
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderPlaintext(c: ConfirmationContent): string {
  const siteUrl = CANONICAL_URL;
  const divider = '─'.repeat(50);
  let t = `LUXURY INTELLIGENCE\n${divider}\n\n`;
  t += `${c.headline}\n\n`;
  t += c.bodyParagraphs.join('\n\n') + '\n\n';
  t += `${c.ctaLabel}: ${c.ctaUrl}\n\n`;
  t += `${divider}\n`;
  t += `You are receiving this because you signed up at ${siteUrl}\n`;
  if (c.footerNote) t += `${c.footerNote}\n`;
  t += `Unsubscribe from digest emails: ${c.unsubscribeUrl}\n`;
  return t;
}

// ── Resend client helpers ─────────────────────────────────────────────────────

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('[email/transactional] RESEND_API_KEY is not set');
  return new Resend(key);
}

function getFromAddress(): string {
  let from = (process.env.EMAIL_FROM ?? '').trim().replace(/^["']|["']$/g, '');
  if (!from) throw new Error('[email/transactional] EMAIL_FROM is not set');
  return from;
}

async function send(to: string, content: ConfirmationContent): Promise<void> {
  const html = renderHtml(content);
  const text = renderPlaintext(content);
  const res  = await getResend().emails.send({
    from:    getFromAddress(),
    to,
    subject: content.subject,
    html,
    text,
  });
  if (res.error) throw new Error(res.error.message ?? JSON.stringify(res.error));
  console.log(`[email/transactional] sent to=${to} subject="${content.subject}" id=${res.data?.id}`);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send a free-tier signup confirmation.
 * Call this only when the subscriber is genuinely new / first-time free signup.
 */
export async function sendFreeConfirmationEmail(email: string): Promise<void> {
  const unsubUrl = buildUnsubscribeUrl(email, CANONICAL_URL);

  await send(email, {
    subject:   "You're subscribed to Luxury Intelligence",
    headline:  "You're subscribed.",
    bodyParagraphs: [
      "You'll receive the weekly Luxury Intelligence digest — a curated briefing covering AI strategy, ecommerce, jewellery, and luxury industry news.",
      "Issues are published each week and also available at luxury-intel.com whenever you want to browse the archive.",
    ],
    ctaLabel:      'Read latest digest',
    ctaUrl:        `${CANONICAL_URL}/#categories`,
    unsubscribeUrl: unsubUrl,
  });
}

/**
 * Send a paid-tier activation confirmation.
 * Call this only when payment is first confirmed active (checkout.session.completed).
 */
export async function sendPaidConfirmationEmail(
  email:    string,
  planType: 'supporter_monthly' | 'patron_monthly',
): Promise<void> {
  const unsubUrl = buildUnsubscribeUrl(email, CANONICAL_URL);
  const planLabel = planType === 'patron_monthly'
    ? 'Patron — €3 / month'
    : 'Supporter — €1 / month';

  const footerNote =
    'Unsubscribing from digest emails does not cancel your payment subscription.';

  await send(email, {
    subject:   'Your Luxury Intelligence support is active',
    headline:  'Thank you — your support is active.',
    bodyParagraphs: [
      `Your ${planLabel} subscription is confirmed. Your support covers the infrastructure that keeps Luxury Intelligence running — hosting, AI summarisation, and the tools behind each weekly brief.`,
      'The weekly digest will be sent to this email address, starting from the next issue.',
      'To cancel or manage your payment, use the link in the Stripe receipt email you received, or reply to this message.',
      `Note: ${footerNote}`,
    ],
    ctaLabel:      'Read latest digest',
    ctaUrl:        `${CANONICAL_URL}/#categories`,
    footerNote,
    unsubscribeUrl: unsubUrl,
  });
}
