/**
 * Send weekly email digest using Resend
 * Dry-run by default (set EMAIL_SEND_ENABLED=true to actually send)
 * Uses the unified EmailDigest format (data/weeks/{week}/email-digest.json).
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';
import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';
import { renderEmailDigestHtml, renderEmailDigestPlaintext } from '../lib/digest/renderEmailDigestHtml';
import type { EmailDigest } from '../lib/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
loadEnv();

type Recipient = {
  email: string;
  name?: string;
};

/**
 * Load recipients from data/email/recipients.json
 */
async function loadRecipients(): Promise<Recipient[]> {
  const recipientsPath = path.join(process.cwd(), 'data', 'email', 'recipients.json');
  try {
    const raw = await fs.readFile(recipientsPath, 'utf-8');
    // Remove BOM if present
    const cleaned = raw.replace(/^\uFEFF/, '');
    const recipients = JSON.parse(cleaned) as Recipient[];
    if (!Array.isArray(recipients)) {
      throw new Error('recipients.json must contain an array');
    }
    return recipients.filter(r => r.email && typeof r.email === 'string');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Recipients file not found: ${recipientsPath}\nCreate it with: [{"email": "user@example.com", "name": "Optional Name"}]`);
    }
    throw new Error(`Failed to load recipients: ${error.message}`);
  }
}

/**
 * Load email digest from data/weeks/{week}/email-digest.json (unified format).
 */
async function loadDigest(weekLabel: string): Promise<EmailDigest> {
  const digestPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'email-digest.json');
  try {
    const raw = await fs.readFile(digestPath, 'utf-8');
    return JSON.parse(raw) as EmailDigest;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Email digest not found: ${digestPath}\nRun the weekly pipeline (including email step) for --week=${weekLabel}`);
    }
    throw new Error(`Failed to load email digest: ${error.message}`);
  }
}

/**
 * Send emails in batches
 */
async function sendEmails(
  recipients: Recipient[],
  subject: string,
  html: string,
  text: string,
  fromEmail: string,
  resend: Resend
): Promise<{ success: number; failures: Array<{ email: string; error: string }> }> {
  const BATCH_SIZE = 50;
  let success = 0;
  const failures: Array<{ email: string; error: string }> = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    console.log(`[Email] Sending batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(recipients.length / BATCH_SIZE)} (${batch.length} recipients)...`);

    const promises = batch.map(async (recipient) => {
      try {
        const response = await resend.emails.send({
          from: fromEmail,
          to: recipient.email,
          subject,
          html,
          text,
        });
        
        // Log response for debugging
        if (response.data) {
          console.log(`[Email] Sent to ${recipient.email}, ID: ${response.data.id || 'unknown'}`);
        } else if (response.error) {
          const errorMsg = response.error.message || JSON.stringify(response.error);
          console.error(`[Email] Resend API error for ${recipient.email}: ${errorMsg}`);
          return { success: false, email: recipient.email, error: errorMsg };
        }
        
        return { success: true, email: recipient.email, emailId: response.data?.id };
      } catch (error: any) {
        const errorMsg = error.message || error.toString();
        console.error(`[Email] Exception sending to ${recipient.email}: ${errorMsg}`);
        if (error.response?.data) {
          console.error(`[Email] Resend API response: ${JSON.stringify(error.response.data)}`);
        }
        return { success: false, email: recipient.email, error: errorMsg };
      }
    });

    const results = await Promise.all(promises);
    for (const result of results) {
      if (result.success) {
        success++;
      } else {
        failures.push({ email: result.email, error: result.error || 'Unknown error' });
        console.error(`[Email] Failed to send to ${result.email}: ${result.error || 'Unknown error'}`);
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { success, failures };
}

/**
 * Save sent summary
 */
async function saveSentSummary(
  weekLabel: string,
  timestamp: string,
  recipientCount: number,
  successCount: number,
  failures: Array<{ email: string; error: string }>
): Promise<void> {
  const sentDir = path.join(process.cwd(), 'data', 'email', 'sent');
  await fs.mkdir(sentDir, { recursive: true });

  const summary = {
    weekLabel,
    timestamp,
    recipientCount,
    successCount,
    failureCount: failures.length,
    failures,
  };

  const summaryPath = path.join(sentDir, `${weekLabel}.json`);
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`[Email] Sent summary saved to: ${summaryPath}`);
}

async function main() {
  // Parse week argument
  const args = process.argv.slice(2);
  let weekLabel: string | null = null;

  for (const arg of args) {
    if (arg.startsWith('--week=')) {
      weekLabel = arg.split('=')[1];
      break;
    }
  }

  if (!weekLabel) {
    weekLabel = getCurrentDigestWeek();
  }
  validateWeekLabel(weekLabel);

  console.log(`[Email] Preparing weekly digest email for ${weekLabel}...`);

  // Load digest and recipients
  const digest = await loadDigest(weekLabel);
  const recipients = await loadRecipients();

  if (recipients.length === 0) {
    console.error('[Email] No recipients found in recipients.json');
    process.exit(1);
  }

  // Render email (unified digest format: single ranked list)
  const subject = `Luxury Intelligence — Weekly Digest ${weekLabel}`;
  const html = renderEmailDigestHtml(digest, { mode: 'email' });
  const text = renderEmailDigestPlaintext(digest);

  // Check if sending is enabled
  const sendEnabled = process.env.EMAIL_SEND_ENABLED === 'true';

  if (!sendEnabled) {
    // Dry run mode
    console.log('\n=== DRY RUN MODE ===');
    console.log(`Recipients: ${recipients.length}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML preview (first 300 chars):`);
    console.log(html.substring(0, 300) + '...');
    console.log('\nTo actually send emails, set: EMAIL_SEND_ENABLED=true');
    console.log('Also required: RESEND_API_KEY and EMAIL_FROM');
    process.exit(0);
  }

  // Sending enabled - check required env vars
  const resendApiKey = process.env.RESEND_API_KEY;
  let fromEmail = process.env.EMAIL_FROM;

  if (!resendApiKey) {
    console.error('[Email] ❌ RESEND_API_KEY is required when EMAIL_SEND_ENABLED=true');
    process.exit(1);
  }

  if (!fromEmail) {
    console.error('[Email] ❌ EMAIL_FROM is required when EMAIL_SEND_ENABLED=true');
    console.error('[Email] Example: EMAIL_FROM="Luxury Intelligence <hello@digest.luxury-intel.com>"');
    process.exit(1);
  }

  // Strip quotes if present (common when copied from .env files)
  fromEmail = fromEmail.trim().replace(/^["']|["']$/g, '');

  // Validate format: should be either "email@domain.com" or "Name <email@domain.com>"
  const emailPattern = /^(.+?)\s*<([^>]+@[^>]+)>$|^([^\s<]+@[^\s>]+)$/;
  if (!emailPattern.test(fromEmail)) {
    console.error('[Email] ❌ Invalid EMAIL_FROM format');
    console.error('[Email] Expected: "email@domain.com" or "Name <email@domain.com>"');
    console.error('[Email] Got:', JSON.stringify(fromEmail));
    process.exit(1);
  }

  // Extract domain from EMAIL_FROM for verification warning
  let fromDomain: string | null = null;
  const angleBracketMatch = fromEmail.match(/<([^>]+@[^>]+)>/);
  const directEmailMatch = fromEmail.match(/([^\s<]+@[^\s>]+)/);
  const emailAddress = angleBracketMatch ? angleBracketMatch[1] : (directEmailMatch ? directEmailMatch[1] : null);
  if (emailAddress) {
    fromDomain = emailAddress.split('@')[1];
  }
  if (fromDomain) {
    console.log(`[Email] Sender domain: ${fromDomain}`);
    console.log(`[Email] ⚠️  Ensure this domain is verified in your Resend dashboard`);
  }

  // Send emails
  console.log(`[Email] Sending to ${recipients.length} recipients...`);
  console.log(`[Email] From: ${fromEmail}`);
  console.log(`[Email] Subject: ${subject}`);
  const resend = new Resend(resendApiKey);
  const timestamp = new Date().toISOString();

  const { success, failures } = await sendEmails(recipients, subject, html, text, fromEmail, resend);

  console.log(`[Email] ✓ Sent successfully: ${success}/${recipients.length}`);
  if (failures.length > 0) {
    console.error(`[Email] ✗ Failed: ${failures.length}/${recipients.length}`);
  }

  // Save summary
  await saveSentSummary(weekLabel, timestamp, recipients.length, success, failures);

  if (failures.length > 0) {
    console.error(`[Email] Some emails failed. Check ${path.join('data', 'email', 'sent', `${weekLabel}.json`)} for details.`);
    process.exit(1);
  }

  console.log(`[Email] ✓ All emails sent successfully`);
  process.exit(0);
}

main().catch((error) => {
  console.error('[Email] Fatal error:', error);
  process.exit(1);
});
