/**
 * Shared rendering for the unified email digest (EmailDigest).
 * Used by the weekly email send script and can be used by the web page for consistency.
 */

import type { EmailDigest, EmailDigestItem } from '../types';

const IMPLICATION_PATTERNS = [
  /implication/i,
  /for retailers/i,
  /for brands/i,
  /what this means/i,
  /why it matters/i,
  /takeaway/i,
  /so what/i,
  /bottom line/i,
  /how to respond/i,
  /should consider/i,
  /must adapt/i,
  /should leverage/i,
  /can leverage/i,
  /must reassess/i,
  /strategists should/i,
  /retailers should/i,
  /retailers must/i,
  /retailers can/i,
];

function normalizeBullet(b: string): string {
  let s = b.trim();
  s = s.replace(/^[-•]\s*/, '').replace(/^\d+[.)]\s*/, '');
  return s;
}

/**
 * Extract up to 3 summary bullets for display, filtering implication-style lines.
 */
export function extractSummaryBullets(item: EmailDigestItem): string[] {
  let filtered = item.bullets
    .map(normalizeBullet)
    .filter(b => b.length >= 10 && !IMPLICATION_PATTERNS.some(p => p.test(b)));

  if (filtered.length >= 3) return filtered.slice(0, 3);

  if (item.summary && item.summary.trim().length > 0) {
    const sentences = item.summary
      .split(/[.!?]+\s+/)
      .map(s => s.trim())
      .filter(s => s.length >= 20 && !IMPLICATION_PATTERNS.some(p => p.test(s)));
    for (const sentence of sentences) {
      if (filtered.length >= 3) break;
      const isDup = filtered.some(b => {
        const a = b.toLowerCase().split(/\s+/);
        const c = sentence.toLowerCase().split(/\s+/);
        const overlap = a.filter(w => c.includes(w)).length;
        return overlap > Math.min(a.length, c.length) * 0.5;
      });
      if (!isDup) filtered.push(sentence);
    }
  }

  while (filtered.length < 3) {
    filtered.push('Read the full article for complete details.');
  }
  return filtered.slice(0, 3);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export type RenderEmailDigestOptions = { mode: 'email' };

/**
 * Render EmailDigest as HTML. For mode 'email', uses inline styles for email clients.
 */
export function renderEmailDigestHtml(digest: EmailDigest, _opts: RenderEmailDigestOptions): string {
  const week = digest.week;

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Digest — Week ${escapeHtml(week)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">Email Digest</h1>
  <p style="font-size: 14px; color: #666; margin-bottom: 24px;">A single ranked list of the week's top articles for retail, luxury, and AI intelligence.</p>
  <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e5e5;">
    <h2 style="font-size: 18px; font-weight: 700; color: #1a1a1a; margin: 0 0 4px 0;">Week ${escapeHtml(week)}</h2>
    ${digest.generatedAt ? `<p style="font-size: 12px; color: #888; margin: 0;">Generated ${escapeHtml(new Date(digest.generatedAt).toLocaleDateString())}</p>` : ''}
  </div>
`;

  if (digest.intro) {
    html += `  <div style="margin-bottom: 24px; padding: 16px; background: #f5f5f5; border: 1px solid #e5e5e5; border-radius: 8px;">
    <p style="font-size: 14px; color: #444; margin: 0; line-height: 1.5;">${escapeHtml(digest.intro)}</p>
  </div>
`;
  }

  if (digest.readOneThing) {
    html += `  <div style="margin-bottom: 24px; padding: 16px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
    <p style="font-size: 12px; font-weight: 600; color: #1e40af; margin: 0 0 8px 0;">Read One Thing</p>
    <a href="${escapeHtml(digest.readOneThing.url)}" style="font-size: 16px; font-weight: 500; color: #1d4ed8; text-decoration: none;">${escapeHtml(digest.readOneThing.title)}</a>
  </div>
`;
  }

  html += `  <div style="margin-top: 24px;">
`;
  for (const item of digest.items) {
    const bullets = extractSummaryBullets(item);
    html += `    <div style="margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0;">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; background: #f0f0f0; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 14px; font-weight: 700; color: #555;">${item.rank}</span>
        </div>
        <div style="flex: 1; min-width: 0;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; line-height: 1.3;">
            <a href="${escapeHtml(item.url)}" style="color: #1d4ed8; text-decoration: none; font-weight: 600;">${escapeHtml(item.title)}</a>
          </h3>
          <p style="font-size: 12px; color: #666; margin: 0 0 8px 0;">${escapeHtml(item.source)}</p>
          <ul style="margin: 0; padding-left: 18px; font-size: 14px; color: #444; line-height: 1.5;">
            ${bullets.map(b => `<li style="margin-bottom: 4px;">${escapeHtml(b)}</li>`).join('\n            ')}
          </ul>
        </div>
      </div>
    </div>
`;
  }

  html += `  </div>
  <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #999; text-align: center;">
    <p style="margin: 0;">You're receiving this because you subscribed to the weekly digest.</p>
    <p style="margin: 8px 0 0 0;">Week ${escapeHtml(week)}</p>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Render EmailDigest as plain text for the email text/plain part.
 */
export function renderEmailDigestPlaintext(digest: EmailDigest): string {
  let text = `Email Digest — Week ${digest.week}\n`;
  text += `${'='.repeat(50)}\n\n`;

  if (digest.intro) {
    text += `${digest.intro}\n\n`;
  }

  if (digest.readOneThing) {
    text += `Read One Thing\n`;
    text += `${digest.readOneThing.title}\n`;
    text += `${digest.readOneThing.url}\n\n`;
  }

  for (const item of digest.items) {
    const bullets = extractSummaryBullets(item);
    text += `${item.rank}. ${item.title}\n`;
    text += `${item.url}\n`;
    text += `Source: ${item.source}\n`;
    for (const b of bullets) {
      text += `  • ${b}\n`;
    }
    text += '\n';
  }

  text += `---\nWeek ${digest.week}\n`;
  return text;
}
