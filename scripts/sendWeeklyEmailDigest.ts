/**
 * Send weekly email digest using Resend
 * Dry-run by default (set EMAIL_SEND_ENABLED=true to actually send)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';
import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';
import { getTopicDisplayName } from '../lib/utils/topicNames';
import type { WeeklyDigest, Article, Topic } from '../lib/types';

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
 * Load digest JSON
 */
async function loadDigest(weekLabel: string): Promise<WeeklyDigest> {
  const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
  try {
    const raw = await fs.readFile(digestPath, 'utf-8');
    return JSON.parse(raw) as WeeklyDigest;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Digest not found: ${digestPath}\nRun: npm run digest:weekly -- --week=${weekLabel}`);
    }
    throw new Error(`Failed to load digest: ${error.message}`);
  }
}

/**
 * Get article summary (prefer aiSummary, fallback to snippet)
 */
function getArticleSummary(article: Article): string {
  if (article.aiSummary && article.aiSummary.trim().length > 0) {
    return article.aiSummary.trim();
  }
  if (article.snippet && article.snippet.trim().length > 0) {
    return article.snippet.trim();
  }
  return 'No summary available.';
}

/**
 * Render HTML email
 */
function renderHTML(digest: WeeklyDigest): string {
  const topicOrder: Topic[] = [
    'Ecommerce_Retail_Tech',
    'Jewellery_Industry',
    'AI_and_Strategy',
    'Luxury_and_Consumer',
  ];

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Luxury Intelligence — Weekly Digest ${digest.weekLabel}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #6b2d5c; font-size: 24px; margin-bottom: 10px; }
    h2 { color: #25505f; font-size: 18px; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #e0e0e0; padding-bottom: 5px; }
    .article { margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0; }
    .article:last-child { border-bottom: none; }
    .article-title { font-size: 16px; font-weight: 600; margin-bottom: 5px; }
    .article-title a { color: #0066cc; text-decoration: none; }
    .article-title a:hover { text-decoration: underline; }
    .article-meta { font-size: 12px; color: #666; margin-bottom: 8px; }
    .article-summary { font-size: 14px; color: #555; line-height: 1.5; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <h1>Luxury Intelligence — Weekly Digest ${digest.weekLabel}</h1>
`;

  if (digest.introParagraph) {
    html += `  <p style="font-size: 14px; color: #666; margin-bottom: 30px;">${escapeHtml(digest.introParagraph)}</p>\n`;
  }

  for (const topicKey of topicOrder) {
    const topic = digest.topics[topicKey];
    if (!topic || topic.top.length === 0) continue;

    const topicName = getTopicDisplayName(topicKey);
    html += `  <h2>${escapeHtml(topicName)}</h2>\n`;

    for (const article of topic.top) {
      const summary = getArticleSummary(article);
      html += `  <div class="article">
    <div class="article-title"><a href="${escapeHtml(article.url)}" target="_blank">${escapeHtml(article.title)}</a></div>
    <div class="article-meta">${escapeHtml(article.source)}</div>
    <div class="article-summary">${escapeHtml(summary)}</div>
  </div>
`;
    }
  }

  html += `  <div class="footer">
    <p>You're receiving this because you subscribed to Luxury Intelligence weekly digest.</p>
    <p>Week ${digest.weekLabel} | ${digest.startISO ? new Date(digest.startISO).toLocaleDateString() : ''} - ${digest.endISO ? new Date(digest.endISO).toLocaleDateString() : ''}</p>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Render plaintext email
 */
function renderPlaintext(digest: WeeklyDigest): string {
  const topicOrder: Topic[] = [
    'Ecommerce_Retail_Tech',
    'Jewellery_Industry',
    'AI_and_Strategy',
    'Luxury_and_Consumer',
  ];

  let text = `Luxury Intelligence — Weekly Digest ${digest.weekLabel}\n`;
  text += `${'='.repeat(50)}\n\n`;

  if (digest.introParagraph) {
    text += `${digest.introParagraph}\n\n`;
  }

  for (const topicKey of topicOrder) {
    const topic = digest.topics[topicKey];
    if (!topic || topic.top.length === 0) continue;

    const topicName = getTopicDisplayName(topicKey);
    text += `${topicName}\n`;
    text += `${'-'.repeat(topicName.length)}\n\n`;

    for (const article of topic.top) {
      const summary = getArticleSummary(article);
      text += `${article.title}\n`;
      text += `${article.url}\n`;
      text += `Source: ${article.source}\n`;
      text += `${summary}\n\n`;
    }
  }

  text += `\n---\n`;
  text += `Week ${digest.weekLabel} | ${digest.startISO ? new Date(digest.startISO).toLocaleDateString() : ''} - ${digest.endISO ? new Date(digest.endISO).toLocaleDateString() : ''}\n`;

  return text;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

  // Render email
  const subject = `Luxury Intelligence — Weekly Digest ${weekLabel}`;
  const html = renderHTML(digest);
  const text = renderPlaintext(digest);

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
  const fromEmail = process.env.EMAIL_FROM;

  if (!resendApiKey) {
    console.error('[Email] ❌ RESEND_API_KEY is required when EMAIL_SEND_ENABLED=true');
    process.exit(1);
  }

  if (!fromEmail) {
    console.error('[Email] ❌ EMAIL_FROM is required when EMAIL_SEND_ENABLED=true');
    console.error('[Email] Example: EMAIL_FROM="Luxury Intelligence <noreply@luxury-intel.com>"');
    process.exit(1);
  }

  // Extract domain from EMAIL_FROM for verification warning
  const emailMatch = fromEmail.match(/<([^>]+)>/) || fromEmail.match(/([^\s<]+@[^\s>]+)/);
  const fromDomain = emailMatch ? emailMatch[1].split('@')[1] : null;
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
