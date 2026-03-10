/**
 * Helpers for digest stats used in StatsBar and secondary copy.
 */

import type { WeeklyDigest } from '@/lib/types';

/** Number of articles published in the digest (sum of topic top arrays). */
export function getSelectedArticleCount(digest: WeeklyDigest): number {
  return (
    digest.topics.AI_and_Strategy.top.length +
    digest.topics.Ecommerce_Retail_Tech.top.length +
    digest.topics.Luxury_and_Consumer.top.length +
    digest.topics.Jewellery_Industry.top.length
  );
}

/**
 * Format the stats bar secondary line:
 * "434 articles analysed · 28 selected · 4 categories · ~12 min podcast"
 * Podcast part uses podcastMinutes when provided, otherwise "~12 min".
 */
export function formatStatsSecondaryLine(
  total: number,
  selectedCount: number,
  podcastMinutes?: number
): string {
  const podcast =
    podcastMinutes != null
      ? `~${Math.round(podcastMinutes)} min podcast`
      : '~12 min podcast';
  return `${total} articles analysed · ${selectedCount} selected · 4 categories · ${podcast}`;
}
