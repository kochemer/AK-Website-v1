/**
 * Check: Domain concentration
 * Warns if any single domain is > 40% of a category
 */

import type { WeeklyDigest, Topic, Article } from '../../lib/types';

const TOPIC_DISPLAY_NAMES: Record<Topic, string> = {
  'AI_and_Strategy': 'AI & Strategy',
  'Ecommerce_Retail_Tech': 'Ecommerce & Retail Tech',
  'Luxury_and_Consumer': 'Luxury & Consumer',
  'Jewellery_Industry': 'Jewellery Industry',
};

function extractDomain(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Try using URL constructor (handles http://, https://, etc.)
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // Fallback: try to extract domain manually
    // Remove protocol if present
    let cleanUrl = url.replace(/^https?:\/\//, '');
    // Remove path and query
    cleanUrl = cleanUrl.split('/')[0];
    // Remove port if present
    cleanUrl = cleanUrl.split(':')[0];
    
    if (cleanUrl && cleanUrl.length > 0) {
      return cleanUrl;
    }
  }

  return null;
}

export function checkDomainConcentration(digest: WeeklyDigest): string[] {
  const warnings: string[] = [];
  const MAX_DOMAIN_SHARE = 40; // percentage

  const topics: Topic[] = [
    'AI_and_Strategy',
    'Ecommerce_Retail_Tech',
    'Luxury_and_Consumer',
    'Jewellery_Industry',
  ];

  for (const topic of topics) {
    const articles = digest.topics[topic].top;

    if (articles.length === 0) {
      continue;
    }

    // Count articles by domain
    const domainCounts = new Map<string, number>();
    for (const article of articles) {
      const domain = extractDomain(article.url);
      if (domain) {
        domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
      }
    }

    // Check if any domain exceeds threshold
    for (const [domain, count] of domainCounts.entries()) {
      const share = (count / articles.length) * 100;
      if (share > MAX_DOMAIN_SHARE) {
        warnings.push(
          `${TOPIC_DISPLAY_NAMES[topic]}: ${domain} represents ${share.toFixed(1)}% (${count}/${articles.length}) - exceeds ${MAX_DOMAIN_SHARE}% threshold`
        );
      }
    }
  }

  return warnings;
}
