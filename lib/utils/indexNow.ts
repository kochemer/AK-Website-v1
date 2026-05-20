import { getSiteUrl } from './siteUrl';
import { weekLabelToSlug } from './weekSlug';

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'ec1d809d29f2093f6ced03fbf98b8eea';
const INDEXNOW_API = 'https://api.indexnow.org/indexnow';

/**
 * Ping IndexNow to notify search engines of new/updated URLs.
 * Non-blocking — logs result but never throws.
 */
export async function pingIndexNow(urls: string[]): Promise<void> {
  if (!urls.length) return;

  const siteUrl = getSiteUrl();
  const host = new URL(siteUrl).hostname;
  const keyLocation = `${siteUrl}/${INDEXNOW_KEY}.txt`;

  try {
    const res = await fetch(INDEXNOW_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation, urlList: urls }),
    });

    if (res.ok || res.status === 202) {
      console.log(`[IndexNow] ✓ Pinged ${urls.length} URL(s) (status ${res.status})`);
      urls.forEach(u => console.log(`  ${u}`));
    } else {
      console.warn(`[IndexNow] ⚠ Unexpected status ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.warn(`[IndexNow] ⚠ Ping failed (non-fatal): ${(err as Error).message}`);
  }
}

/**
 * Ping IndexNow for a newly published digest week.
 * Submits the digest page URL + homepage.
 */
export async function pingIndexNowForWeek(weekLabel: string): Promise<void> {
  const siteUrl = getSiteUrl();
  const slug = weekLabelToSlug(weekLabel);
  await pingIndexNow([
    siteUrl,
    `${siteUrl}/digest/${slug}`,
  ]);
}
