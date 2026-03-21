import { COMPETITOR_BRANDS, type CompetitorId } from '@/lib/constants/competitorBrands';
import type { Article } from '@/lib/types/article';

/**
 * Scans an article's text fields for competitor brand mentions.
 * Returns all matching CompetitorIds (an article can match multiple brands).
 */
export function matchCompetitors(article: Article): CompetitorId[] {
  const text = [
    article.title,
    article.source,
    article.snippet,
    article.aiSummary,
    article.summary,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const matched: CompetitorId[] = [];
  for (const brand of COMPETITOR_BRANDS) {
    if (brand.aliases.some((alias) => text.includes(alias))) {
      matched.push(brand.id);
    }
  }
  return matched;
}
