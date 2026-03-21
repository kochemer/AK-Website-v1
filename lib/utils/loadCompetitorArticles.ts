import { promises as fs } from 'fs';
import path from 'path';
import { DateTime } from 'luxon';
import type { Article } from '@/lib/types/article';
import { COMPETITOR_BRANDS, type CompetitorId } from '@/lib/constants/competitorBrands';
import { matchCompetitors } from '@/lib/utils/competitorMatcher';

/**
 * Server-side data loader for the Competitor Watch page.
 * Reads data/articles.json, filters to the last 12 weeks, scans each article
 * for brand mentions, and returns a Map<CompetitorId, Article[]> sorted by recency.
 * Only articles matching at least one competitor are included.
 */
export async function loadCompetitorArticles(): Promise<Map<CompetitorId, Article[]>> {
  const articlesPath = path.join(process.cwd(), 'data', 'articles.json');

  let articles: Article[] = [];
  try {
    const raw = await fs.readFile(articlesPath, 'utf-8');
    articles = JSON.parse(raw) as Article[];
  } catch {
    return new Map();
  }

  // Pre-filter to last 12 weeks before scanning (articles.json grows unbounded)
  const cutoff = DateTime.now().minus({ weeks: 12 }).toISO()!;
  const recent = articles.filter((a) => {
    const date = a.published_at || a.discoveredAt || a.ingested_at;
    return !!date && date >= cutoff;
  });

  // Build brand buckets
  const brandMap = new Map<CompetitorId, Article[]>();
  for (const brand of COMPETITOR_BRANDS) {
    brandMap.set(brand.id, []);
  }

  for (const article of recent) {
    const matches = matchCompetitors(article);
    for (const brandId of matches) {
      brandMap.get(brandId)!.push(article);
    }
  }

  // Sort each bucket by recency (newest first) and drop empty buckets
  for (const [brandId, brandArticles] of brandMap) {
    if (brandArticles.length === 0) {
      brandMap.delete(brandId);
      continue;
    }
    brandMap.set(
      brandId,
      brandArticles.sort((a, b) => {
        const dateA = a.published_at || a.ingested_at || '';
        const dateB = b.published_at || b.ingested_at || '';
        return dateB.localeCompare(dateA);
      })
    );
  }

  return brandMap;
}
