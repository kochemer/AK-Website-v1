import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import { getMonthRangeCET } from '../utils/monthCET';
import { classifyTopic } from '../classification/classifyTopics';
import type { Article } from '../ingestion/types';
import type { Topic } from '../classification/classifyTopics';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOP_N = 7;
const MAX_PER_SOURCE = 3; // Diversity guard: max articles per source in top N

// --- Relevance Ranking Configuration ---

/**
 * Source weights: positive values boost articles from these sources
 * Default weight is 0 for sources not listed
 */
const SOURCE_WEIGHTS: Record<string, number> = {
  "Jeweller - Business News": 0.1,
  "Professional Jeweller": 0.1,
  "NYTimes Technology": 0.15,
  "Modern Retail": 0.1,
  "Practical Ecommerce": 0.1,
  "Retail Dive": 0.1,
  "Harvard Business Review (Technology & AI)": 0.15,
  "McKinsey & Company: Artificial Intelligence": 0.15,
};

/**
 * Topic-specific keywords for boosting relevance
 * Case-insensitive matching in title and snippet
 */
const TOPIC_KEYWORDS: Record<Topic, string[]> = {
  "Jewellery Industry": [
    "jewellery", "jewelry", "diamond", "gem", "precious metal", "gold", "silver",
    "retailer", "jeweller", "hallmark", "assay", "watch", "timepiece"
  ],
  "Ecommerce Technology": [
    "ecommerce", "e-commerce", "online retail", "shopping", "checkout", "payment",
    "platform", "marketplace", "fulfillment", "logistics", "warehouse", "inventory"
  ],
  "AI & Ecommerce Strategy": [
    "artificial intelligence", "ai", "machine learning", "ml", "strategy", "automation",
    "personalization", "recommendation", "chatbot", "analytics", "insights", "data"
  ],
  "Luxury Consumer Behaviour": [
    "luxury", "premium", "high-end", "consumer", "behavior", "spending", "demand",
    "brand", "heritage", "exclusive", "aspirational", "affluent"
  ],
};

/**
 * Low-signal markers that trigger penalties
 * Case-insensitive matching in title and snippet
 */
const LOW_SIGNAL_MARKERS = [
  "sponsored", "press release", "advertorial", "advertisement", "promoted",
  "paid content", "sponsored content", "ad", "promo"
];

// Keyword boost per match (small boost)
const KEYWORD_BOOST_PER_MATCH = 0.05;
// Penalty per low-signal marker found
const LOW_SIGNAL_PENALTY = 0.2;

/**
 * Normalize a title for deduplication:
 *  - Lowercase
 *  - Collapse whitespace
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deduplicate articles within a topic by normalized title,
 * keeping the newest published_at. 
 */
function dedupeArticles(articles: Article[]): Article[] {
  const map = new Map<string, Article>();
  for (const art of articles) {
    const normTitle = normalizeTitle(art.title);
    if (!map.has(normTitle)) {
      map.set(normTitle, art);
    } else {
      // Keep the newer version
      const existing = map.get(normTitle)!;
      const artTime = art.published_at ? new Date(art.published_at).getTime() : 0;
      const existTime = existing.published_at ? new Date(existing.published_at).getTime() : 0;
      if (artTime > existTime) {
        map.set(normTitle, art);
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Relevance score breakdown for explainability
 */
type RelevanceScore = {
  scoreTotal: number;
  recencyScore: number;
  sourceWeight: number;
  keywordBoost: number;
  penalty: number;
  matchedKeywords: string[];
};

/**
 * Article with relevance scoring (only added to selected top items)
 */
type ArticleWithRelevance = Article & {
  relevance?: RelevanceScore;
};

/**
 * Calculate recency score: map publishedAt within month to 0..1 (newest=1)
 */
function calculateRecencyScore(publishedAt: string, monthStart: number, monthEnd: number): number {
  if (!publishedAt) return 0;
  const articleTime = new Date(publishedAt).getTime();
  if (isNaN(articleTime) || articleTime < monthStart || articleTime > monthEnd) return 0;
  
  // Normalize to 0..1 where newest (monthEnd) = 1, oldest (monthStart) = 0
  const monthDuration = monthEnd - monthStart;
  if (monthDuration === 0) return 1;
  return (articleTime - monthStart) / monthDuration;
}

/**
 * Find matched keywords in text (case-insensitive)
 */
function findMatchedKeywords(text: string, keywords: string[]): string[] {
  const lowerText = text.toLowerCase();
  return keywords.filter(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Calculate keyword boost based on topic-specific keywords
 */
function calculateKeywordBoost(article: Article, topic: Topic): { boost: number; matched: string[] } {
  const keywords = TOPIC_KEYWORDS[topic] || [];
  const titleMatches = findMatchedKeywords(article.title, keywords);
  const snippetMatches = article.snippet ? findMatchedKeywords(article.snippet, keywords) : [];
  
  // Combine and deduplicate
  const allMatches = Array.from(new Set([...titleMatches, ...snippetMatches]));
  const boost = allMatches.length * KEYWORD_BOOST_PER_MATCH;
  
  return { boost, matched: allMatches };
}

/**
 * Calculate penalty for low-signal markers
 */
function calculatePenalty(article: Article): number {
  const text = `${article.title} ${article.snippet || ''}`.toLowerCase();
  const matches = LOW_SIGNAL_MARKERS.filter(marker => text.includes(marker.toLowerCase()));
  return matches.length * LOW_SIGNAL_PENALTY;
}

/**
 * Calculate composite relevance score for an article
 */
function calculateRelevanceScore(
  article: Article,
  topic: Topic,
  monthStart: number,
  monthEnd: number
): RelevanceScore {
  // Recency score (0..1)
  const recencyScore = calculateRecencyScore(article.published_at, monthStart, monthEnd);
  
  // Source weight (default 0)
  const sourceWeight = SOURCE_WEIGHTS[article.source] || 0;
  
  // Keyword boost
  const { boost: keywordBoost, matched: matchedKeywords } = calculateKeywordBoost(article, topic);
  
  // Penalty
  const penalty = calculatePenalty(article);
  
  // Total score
  const scoreTotal = recencyScore + sourceWeight + keywordBoost - penalty;
  
  return {
    scoreTotal,
    recencyScore,
    sourceWeight,
    keywordBoost,
    penalty,
    matchedKeywords,
  };
}

/**
 * Select top N articles with composite scoring and diversity guard
 * Returns articles with relevance scores attached
 */
function selectTopN(
  articles: Article[],
  n: number,
  topic: Topic,
  monthStart: number,
  monthEnd: number
): ArticleWithRelevance[] {
  if (articles.length === 0) return [];
  
  // Calculate scores for all articles
  const articlesWithScores = articles.map(article => ({
    article,
    relevance: calculateRelevanceScore(article, topic, monthStart, monthEnd),
  }));
  
  // Sort by total score (descending), then by URL for determinism
  articlesWithScores.sort((a, b) => {
    if (Math.abs(a.relevance.scoreTotal - b.relevance.scoreTotal) > 0.0001) {
      return b.relevance.scoreTotal - a.relevance.scoreTotal;
    }
    return a.article.url.localeCompare(b.article.url);
  });
  
  // Apply diversity guard: limit max per source, but relax if needed to fill to N
  const selected: ArticleWithRelevance[] = [];
  const sourceCounts = new Map<string, number>();
  
  for (let i = 0; i < articlesWithScores.length && selected.length < n; i++) {
    const { article, relevance } = articlesWithScores[i];
    const currentCount = sourceCounts.get(article.source) || 0;
    const remainingSlots = n - selected.length;
    const remainingArticles = articlesWithScores.length - i;
    
    // Check if we can add this article:
    // 1. Haven't hit the cap for this source, OR
    // 2. We need to fill remaining slots (relax cap if not enough articles from other sources)
    const canAdd = currentCount < MAX_PER_SOURCE;
    const mustFill = remainingSlots >= remainingArticles; // If remaining slots >= remaining articles, we must take this
    
    if (canAdd || mustFill) {
      selected.push({
        ...article,
        relevance,
      });
      sourceCounts.set(article.source, currentCount + 1);
    }
  }
  
  return selected;
}

export type MonthlyDigest = {
  monthLabel: string;
  tz: string;
  startISO: string;
  endISO: string;
  builtAtISO?: string;
  builtAtLocal?: string;
  totals: {
    total: number;
    byTopic: {
      Jewellery: number;
      Ecommerce: number;
      AIStrategy: number;
      Luxury: number;
    };
  };
  topics: {
    JewelleryIndustry: { total: number; top: ArticleWithRelevance[] };
    EcommerceTechnology: { total: number; top: ArticleWithRelevance[] };
    AIEcommerceStrategy: { total: number; top: ArticleWithRelevance[] };
    LuxuryConsumerBehaviour: { total: number; top: ArticleWithRelevance[] };
  };
};

/**
 * Builds a monthly digest from articles in data/articles.json
 * @param monthLabel - Month in format "YYYY-MM" (e.g. "2025-12")
 * @returns Monthly digest object with totals and topic breakdowns
 */
export async function buildMonthlyDigest(monthLabel: string): Promise<MonthlyDigest> {
  // Parse monthLabel to create a Date (use first day of month)
  const [year, month] = monthLabel.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error(`Invalid monthLabel format: ${monthLabel}. Expected "YYYY-MM"`);
  }
  
  // Create a date in the middle of the month to get the full month range
  const monthDate = new Date(year, month - 1, 15);
  const { monthStartCET, monthEndCET } = getMonthRangeCET(monthDate);
  
  const startISO = monthStartCET.toISOString();
  const endISO = monthEndCET.toISOString();
  
  // Load articles
  const dataPath = path.join(__dirname, '../data/articles.json');
  let articles: Article[] = [];
  try {
    const raw = await fs.readFile(dataPath, 'utf-8');
    articles = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to read articles.json: ${(err as Error).message}`);
  }
  
  // Filter articles to the month window (exclude those without published_at)
  const monthStart = monthStartCET.getTime();
  const monthEnd = monthEndCET.getTime();
  
  const eligibleArticles = articles.filter(article => {
    if (!article.published_at) return false;
    const dt = new Date(article.published_at);
    if (isNaN(dt.getTime())) return false;
    const t = dt.getTime();
    return t >= monthStart && t <= monthEnd;
  });
  
  // Classify articles and group by topic
  const byTopic: Record<Topic, Article[]> = {
    "Jewellery Industry": [],
    "Ecommerce Technology": [],
    "AI & Ecommerce Strategy": [],
    "Luxury Consumer Behaviour": [],
  };
  
  for (const article of eligibleArticles) {
    const topic = classifyTopic(article);
    byTopic[topic].push(article);
  }
  
  // Deduplicate articles within each topic
  for (const topicKey of Object.keys(byTopic) as Topic[]) {
    byTopic[topicKey] = dedupeArticles(byTopic[topicKey]);
  }
  
  // Build totals (after deduplication)
  const totals = {
    total: eligibleArticles.length,
    byTopic: {
      Jewellery: byTopic["Jewellery Industry"].length,
      Ecommerce: byTopic["Ecommerce Technology"].length,
      AIStrategy: byTopic["AI & Ecommerce Strategy"].length,
      Luxury: byTopic["Luxury Consumer Behaviour"].length,
    },
  };
  
  // Build topics structure with top N articles (with relevance scores)
  const topics = {
    JewelleryIndustry: {
      total: byTopic["Jewellery Industry"].length,
      top: selectTopN(byTopic["Jewellery Industry"], TOP_N, "Jewellery Industry", monthStart, monthEnd),
    },
    EcommerceTechnology: {
      total: byTopic["Ecommerce Technology"].length,
      top: selectTopN(byTopic["Ecommerce Technology"], TOP_N, "Ecommerce Technology", monthStart, monthEnd),
    },
    AIEcommerceStrategy: {
      total: byTopic["AI & Ecommerce Strategy"].length,
      top: selectTopN(byTopic["AI & Ecommerce Strategy"], TOP_N, "AI & Ecommerce Strategy", monthStart, monthEnd),
    },
    LuxuryConsumerBehaviour: {
      total: byTopic["Luxury Consumer Behaviour"].length,
      top: selectTopN(byTopic["Luxury Consumer Behaviour"], TOP_N, "Luxury Consumer Behaviour", monthStart, monthEnd),
    },
  };
  
  // Get current timestamp in Europe/Copenhagen
  const now = DateTime.now().setZone('Europe/Copenhagen');
  const builtAtISO = now.toISO();
  const builtAtLocal = now.toFormat('yyyy-MM-dd HH:mm:ss');

  return {
    monthLabel,
    tz: "Europe/Copenhagen",
    startISO,
    endISO,
    builtAtISO: builtAtISO || undefined,
    builtAtLocal,
    totals,
    topics,
  };
}

