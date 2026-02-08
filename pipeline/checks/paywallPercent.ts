/**
 * Check: Paywall percentage
 * Warns if paywalled share > 30%
 */

import type { Article } from '../../lib/types';

export function checkPaywallPercent(articles: Article[]): string[] {
  const warnings: string[] = [];

  if (articles.length === 0) {
    return warnings;
  }

  // Count paywalled articles (treat missing paywall field as not paywalled)
  const paywalledCount = articles.filter(article => article.paywalled === true).length;
  const paywallPercent = (paywalledCount / articles.length) * 100;

  if (paywallPercent > 30) {
    warnings.push(
      `Paywalled articles: ${paywallPercent.toFixed(1)}% (${paywalledCount}/${articles.length}) exceeds 30% threshold`
    );
  }

  return warnings;
}
