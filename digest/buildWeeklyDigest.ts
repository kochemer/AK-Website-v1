import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import { getWeekRangeCET } from '../lib/utils/weekCET';
import { classifyTopic } from '../classification/classifyTopics';
import { rerankArticles } from './rerankArticles';
import type { Article, ArticleWithRelevance, RelevanceScore, Topic, WeeklyDigest } from '../lib/types';

// Re-export WeeklyDigest for backward compatibility
export type { WeeklyDigest } from '../lib/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOP_N = 7;
const MAX_PER_SOURCE = 3; // Diversity guard: max articles per source in top N

// --- Relevance Ranking Configuration ---

/**
 * Source weights: positive values boost articles from these sources
 * Default weight is 0 for sources not listed
 * 
 * Note: For AI category, retail sources should NOT be boosted
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
 * AI-focused sources that should be boosted for AI category only
 * These sources typically cover AI field developments, not retail applications
 */
const AI_FOCUSED_SOURCES: string[] = [
  "arXiv - AI", "arXiv - Machine Learning", "arXiv - Computation and Language",
  "arXiv - Computer Vision", "arXiv - Neural and Evolutionary Computing",
  "MIT Technology Review", "The Verge - AI", "TechCrunch - AI",
  "Wired - AI", "IEEE Spectrum", "Nature Machine Intelligence"
];

/**
 * Topic-specific keywords for boosting relevance
 * Case-insensitive matching in title and snippet
 */
const TOPIC_KEYWORDS: Record<Topic, string[]> = {
  "AI_and_Strategy": [
    // AI field importance keywords (not retail-focused)
    "artificial intelligence", "ai", "machine learning", "ml", "llm", "large language model",
    "model release", "benchmark", "research", "arxiv", "openai", "anthropic", "claude", "gemini",
    "deepmind", "foundation model", "transformer", "neural network", "deep learning",
    "computer vision", "nlp", "natural language processing", "multimodal", "agent", "reasoning",
    "inference", "training", "fine-tuning", "weights", "open source", "ai lab", "ai company",
    "ai startup", "funding", "investment", "acquisition", "partnership", "regulation", "policy",
    "ai safety", "alignment", "agi", "compute", "gpu", "tpu", "sota", "state of the art"
  ],
  "Ecommerce_Retail_Tech": [
    "ecommerce", "e-commerce", "online retail", "shopping", "checkout", "payment",
    "platform", "marketplace", "fulfillment", "logistics", "warehouse", "inventory", "retail tech"
  ],
  "Luxury_and_Consumer": [
    "luxury", "premium", "high-end", "consumer", "behavior", "spending", "demand",
    "brand", "heritage", "exclusive", "aspirational", "affluent"
  ],
  "Jewellery_Industry": [
    "jewellery", "jewelry", "diamond", "gem", "precious metal", "gold", "silver",
    "retailer", "jeweller", "hallmark", "assay", "watch", "timepiece"
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

// RelevanceScore and ArticleWithRelevance are now imported from @/lib/types

// Insight markers for insightSignalBoost (case-insensitive substring matching)
const INSIGHT_MARKERS = [
  "benchmark",
  "survey",
  "report",
  "data",
  "metrics",
  "case study",
  "A/B",
  "experiment",
  "uplift",
  "increase",
  "decrease",
  "conversion rate",
  "cart abandonment",
  "NPS",
  "latency",
  "fraud rate",
  "ROI",
  "CAGR",
  "%",
  "percent"
];

/**
 * Find matched keywords in text (case-insensitive)
 * Uses word boundaries for short keywords (<= 3 chars) to avoid false matches (e.g., "ai" in "gain", "sustain")
 */
function findMatchedKeywords(text: string, keywords: string[]): string[] {
  const lowerText = text.toLowerCase();
  return keywords.filter(keyword => {
    const lowerKw = keyword.toLowerCase();
    // For short keywords (<= 3 chars) or single-letter acronyms, use word boundaries
    // Also handle "AI-" prefix pattern
    if (lowerKw.length <= 3 || lowerKw === "ai" || lowerKw === "ml" || lowerKw === "nlp" || lowerKw === "agi") {
      // Use word boundary regex: \b for word boundaries, also allow "-" after (for "AI-powered", "AI-driven", etc.)
      const pattern = new RegExp(`\\b${lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-|\\b)`, 'i');
      return pattern.test(lowerText);
    }
    // For longer keywords, use simple substring matching
    return lowerText.includes(lowerKw);
  });
}

/**
 * Calculate keyword boost based on topic-specific keywords
 * Capped at 0.20 to prevent keyword count from dominating scoring
 */
function calculateKeywordBoost(article: Article, topic: Topic): { boost: number; matched: string[] } {
  const keywords = TOPIC_KEYWORDS[topic] || [];
  const titleMatches = findMatchedKeywords(article.title, keywords);
  const snippetMatches = article.snippet ? findMatchedKeywords(article.snippet, keywords) : [];
  
  // Combine and deduplicate
  const allMatches = Array.from(new Set([...titleMatches, ...snippetMatches]));
  const uncappedBoost = allMatches.length * KEYWORD_BOOST_PER_MATCH;
  const boost = Math.min(0.20, uncappedBoost); // Cap at 0.20
  
  return { boost, matched: allMatches };
}

/**
 * Calculate insight signal boost based on insight markers
 * Rewards articles with data, benchmarks, case studies, metrics, etc.
 */
function calculateInsightSignalBoost(article: Article): number {
  const text = `${article.title} ${article.oneSentenceSummary || article.summary || article.snippet || ''}`.toLowerCase();
  
  const matchedMarkers = INSIGHT_MARKERS.filter(marker => text.includes(marker.toLowerCase()));
  const uncappedBoost = matchedMarkers.length * 0.05;
  const boost = Math.min(0.15, uncappedBoost); // Cap at 0.15
  
  return boost;
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
  weekStart: number,
  weekEnd: number
): RelevanceScore {
  // Recency score removed - no longer used in scoring
  const recencyScore = 0;
  
  // Source weight (default 0)
  // For AI category: boost AI-focused sources, but penalize retail sources
  // SOLUTION 3: Reduce Arxiv boost to prevent dominance in candidate pool
  let sourceWeight = 0;
  if (topic === 'AI_and_Strategy') {
    const isArxivSource = article.source.toLowerCase().includes('arxiv');
    const isAIFocusedSource = AI_FOCUSED_SOURCES.some(aiSource => article.source.includes(aiSource));
    
    // Retail sources that should be penalized in AI category (commerce/ecommerce focus, not AI focus)
    const retailSources = ["Modern Retail", "Digital Commerce 360", "Practical Ecommerce", "Retail Dive"];
    const isRetailSource = retailSources.some(rs => article.source.includes(rs));
    
    if (isRetailSource) {
      // Penalize retail sources in AI category - they typically cover commerce/retail with incidental AI mentions
      sourceWeight = -0.10; // Negative weight to push them down in ranking
    } else if (isArxivSource) {
      // Reduce Arxiv boost to prevent dominance (was 0.15, now 0.05)
      // This ensures more diverse candidate pool for LLM/fallback
      sourceWeight = 0.05;
    } else if (isAIFocusedSource) {
      sourceWeight = 0.15; // Boost other AI-focused sources normally
    } else if (SOURCE_WEIGHTS[article.source]) {
      sourceWeight = SOURCE_WEIGHTS[article.source] * 0.5; // Reduce boost for other sources
    }
  } else {
    // For non-AI categories, use normal source weights
    sourceWeight = SOURCE_WEIGHTS[article.source] || 0;
  }
  
  // Keyword boost (capped at 0.20)
  const { boost: keywordBoost, matched: matchedKeywords } = calculateKeywordBoost(article, topic);
  
  // Insight signal boost (capped at 0.15)
  const insightSignalBoost = calculateInsightSignalBoost(article);
  
  // Penalty
  const penalty = calculatePenalty(article);
  
  // Total score: sourceWeight + keywordBoost + insightSignalBoost - penalty
  // (recencyScore removed)
  const scoreTotal = sourceWeight + keywordBoost + insightSignalBoost - penalty;
  
  return {
    scoreTotal,
    recencyScore,
    sourceWeight,
    keywordBoost,
    insightSignalBoost,
    penalty,
    matchedKeywords,
  };
}

/**
 * Select top N articles using LLM reranking with fallback to deterministic selection
 * Returns articles with relevance scores attached
 */
async function selectTopN(
  articles: Article[],
  n: number,
  topic: Topic,
  weekStart: number,
  weekEnd: number,
  weekLabel: string
): Promise<ArticleWithRelevance[]> {
  if (articles.length === 0) return [];
  
  // Calculate scores for all articles
  const articlesWithScores = articles.map(article => ({
    article,
    relevance: calculateRelevanceScore(article, topic, weekStart, weekEnd),
  }));
  
  // Sort by total score (descending), then by URL for determinism
  articlesWithScores.sort((a, b) => {
    if (Math.abs(a.relevance.scoreTotal - b.relevance.scoreTotal) > 0.0001) {
      return b.relevance.scoreTotal - a.relevance.scoreTotal;
    }
    return a.article.url.localeCompare(b.article.url);
  });
  
  // Select candidates for reranking (up to 100 articles, or all if fewer)
  const CANDIDATE_MAX_LLM = 100; // Allow up to 100 articles for LLM reranking
  const candidateCount = Math.min(
    CANDIDATE_MAX_LLM,
    articlesWithScores.length
  );
  
  const candidates = articlesWithScores.slice(0, candidateCount).map(item => item.article);
  
  // Fallback function: deterministic selection with diversity guard
  // SOLUTION 1: Enforce diversity constraints DURING selection, not after
  const fallbackSelect = (candidateList: Article[]): ArticleWithRelevance[] => {
    const selected: ArticleWithRelevance[] = [];
    const sourceCounts = new Map<string, number>();
    let arxivCount = 0; // Track Arxiv articles for AI category
    
    // Helper to check if source is Arxiv
    const isArxiv = (source: string): boolean => {
      return source.toLowerCase().includes('arxiv');
    };
    
    // Helper to get normalized source for counting (all Arxiv sources count as one for AI category)
    const getNormalizedSource = (source: string): string => {
      if (topic === 'AI_and_Strategy' && isArxiv(source)) {
        return 'Arxiv'; // All Arxiv sources count as one for AI category
      }
      return source;
    };
    
    // Iterate through candidates (already sorted by score)
    // Only add articles that pass diversity constraints
    for (const article of candidateList) {
      if (selected.length >= n) break;
      
      const normalizedSource = getNormalizedSource(article.source);
      const currentCount = sourceCounts.get(normalizedSource) || 0;
      const isArxivArticle = isArxiv(article.source);
      
      // Check diversity constraints
      const canAddSource = currentCount < MAX_PER_SOURCE;
      const canAddArxiv = !isArxivArticle || (topic === 'AI_and_Strategy' ? arxivCount < 1 : true);
      
      // Only add if constraints allow (no mustFill logic - we want diverse selection)
      if (canAddSource && canAddArxiv) {
        // Find the relevance score for this article
        const scoreItem = articlesWithScores.find(item => item.article.url === article.url);
        const relevance = scoreItem?.relevance || {
          scoreTotal: 0,
          recencyScore: 0,
          sourceWeight: 0,
          keywordBoost: 0,
          insightSignalBoost: 0,
          penalty: 0,
          matchedKeywords: [],
        };
        
        selected.push({
          ...article,
          relevance,
        });
        sourceCounts.set(normalizedSource, currentCount + 1);
        if (isArxivArticle && topic === 'AI_and_Strategy') {
          arxivCount++;
        }
      }
      // Skip if constraints violated - continue to next candidate
    }
    
    // If we still don't have enough, we've exhausted diverse candidates
    // This is better than having all Arxiv articles
    return selected;
  };
  
  // Call LLM reranking
  const rerankResult = await rerankArticles(
    weekLabel,
    topic,
    articles.length,
    candidates,
    fallbackSelect
  );
  
  // Map reranked articles back to ArticleWithRelevance format
  const selected: ArticleWithRelevance[] = rerankResult.selected.map(article => {
    // Find the relevance score for this article
    const scoreItem = articlesWithScores.find(item => item.article.url === article.url);
    const relevance = scoreItem?.relevance || {
      scoreTotal: 0,
      recencyScore: 0,
      sourceWeight: 0,
      keywordBoost: 0,
      insightSignalBoost: 0,
      penalty: 0,
      matchedKeywords: [],
    };
    
    return {
      ...article,
      relevance,
    };
  });
  
  return selected;
}

// WeeklyDigest type is now imported and re-exported from @/lib/types

/**
 * Builds a weekly digest from articles in data/articles.json
 * @param weekLabel - Week in format "YYYY-W##" (e.g. "2025-W52")
 * @returns Weekly digest object with totals and topic breakdowns
 */
export async function buildWeeklyDigest(weekLabel: string): Promise<WeeklyDigest> {
  // Parse weekLabel to create a Date (use Monday of the week)
  const weekMatch = weekLabel.match(/^(\d{4})-W(\d{1,2})$/);
  if (!weekMatch) {
    throw new Error(`Invalid weekLabel format: ${weekLabel}. Expected "YYYY-W##" (e.g. "2025-W52")`);
  }
  
  const year = parseInt(weekMatch[1], 10);
  const weekNumber = parseInt(weekMatch[2], 10);
  
  if (weekNumber < 1 || weekNumber > 53) {
    throw new Error(`Invalid week number: ${weekNumber}. Must be between 1 and 53.`);
  }
  
  // Create a DateTime in Europe/Copenhagen for the given week
  // Use Luxon to get the Monday of that week
  const dt = DateTime.fromObject({ weekYear: year, weekNumber }, { zone: 'Europe/Copenhagen' });
  if (!dt.isValid) {
    throw new Error(`Invalid week: ${weekLabel}. ${dt.invalidReason}`);
  }
  
  // Get the week range
  const { weekStartCET, weekEndCET } = getWeekRangeCET(dt.toJSDate());
  
  const startISO = weekStartCET.toISOString();
  const endISO = weekEndCET.toISOString();
  
  // Load articles
  const dataPath = path.join(__dirname, '../data/articles.json');
  let articles: Article[] = [];
  try {
    const raw = await fs.readFile(dataPath, 'utf-8');
    articles = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to read articles.json: ${(err as Error).message}`);
  }
  
  // Filter articles to the week window (exclude those without published_at)
  const weekStart = weekStartCET.getTime();
  const weekEnd = weekEndCET.getTime();
  
  const eligibleArticles = articles.filter(article => {
    if (!article.published_at) return false;
    const dt = new Date(article.published_at);
    if (isNaN(dt.getTime())) return false;
    const t = dt.getTime();
    return t >= weekStart && t <= weekEnd;
  });
  
  // Classify articles and group by topic
  const byTopic: Record<Topic, Article[]> = {
    "AI_and_Strategy": [],
    "Ecommerce_Retail_Tech": [],
    "Luxury_and_Consumer": [],
    "Jewellery_Industry": [],
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
      AIStrategy: byTopic["AI_and_Strategy"].length,
      EcommerceRetail: byTopic["Ecommerce_Retail_Tech"].length,
      LuxuryConsumer: byTopic["Luxury_and_Consumer"].length,
      Jewellery: byTopic["Jewellery_Industry"].length,
    },
  };
  
  // Build topics structure with top N articles (with relevance scores)
  const topics = {
    AI_and_Strategy: {
      total: byTopic["AI_and_Strategy"].length,
      top: await selectTopN(byTopic["AI_and_Strategy"], TOP_N, "AI_and_Strategy", weekStart, weekEnd, weekLabel),
    },
    Ecommerce_Retail_Tech: {
      total: byTopic["Ecommerce_Retail_Tech"].length,
      top: await selectTopN(byTopic["Ecommerce_Retail_Tech"], TOP_N, "Ecommerce_Retail_Tech", weekStart, weekEnd, weekLabel),
    },
    Luxury_and_Consumer: {
      total: byTopic["Luxury_and_Consumer"].length,
      top: await selectTopN(byTopic["Luxury_and_Consumer"], TOP_N, "Luxury_and_Consumer", weekStart, weekEnd, weekLabel),
    },
    Jewellery_Industry: {
      total: byTopic["Jewellery_Industry"].length,
      top: await selectTopN(byTopic["Jewellery_Industry"], TOP_N, "Jewellery_Industry", weekStart, weekEnd, weekLabel),
    },
  };
  
  // Get current timestamp in Europe/Copenhagen
  const now = DateTime.now().setZone('Europe/Copenhagen');
  const builtAtISO = now.toISO();
  const builtAtLocal = now.toFormat('yyyy-MM-dd HH:mm:ss');

  return {
    weekLabel,
    tz: "Europe/Copenhagen",
    startISO,
    endISO,
    builtAtISO: builtAtISO || undefined,
    builtAtLocal,
    totals,
    topics,
  };
}

