/**
 * Canonical Article type definition.
 * 
 * This is the single source of truth for Article types across the codebase.
 * All modules (ingestion, discovery, classification, digest, UI) should import from here.
 * 
 * Field categories:
 * - Core fields: always present after ingestion
 * - Discovery fields: populated by web discovery pipeline
 * - Classification fields: populated by topic classification
 * - Ranking fields: populated by reranking/scoring
 * - Filtering fields: populated by quality filters
 */

/**
 * Source type indicating how the article was ingested
 */
export type ArticleSourceType = 'rss' | 'page' | 'discovery' | 'consultancy' | 'platform';

export type DateSource = 'html' | 'tavily' | 'none' | 'time_text';
export type DateSourceDetail = 'jsonld' | 'meta' | 'time' | 'time_text' | 'tavily' | 'none';
export type DateConfidence = 'high' | 'medium' | 'low';

/**
 * Category hint from RSS source (non-binding, used as classification hint)
 */
export type CategoryHint = 'Fashion & Luxury' | 'Jewellery Industry';

/**
 * Competitor intelligence signal taxonomy.
 * Assigned by competitorAnalyze pipeline step.
 */
export type SignalTag =
  | 'Launch'
  | 'Campaign'
  | 'Partnership'
  | 'Financials'
  | 'Controversy'
  | 'Leadership'
  | 'Expansion';

/**
 * Relevance score breakdown from the ranking algorithm
 */
export interface RelevanceScore {
  scoreTotal: number;
  recencyScore: number; // Kept for backward compatibility, but always 0 now
  sourceWeight: number;
  keywordBoost: number;
  insightSignalBoost: number;
  penalty: number;
  matchedKeywords: string[];
}

/**
 * Canonical Article type - union of all fields used across the pipeline.
 * 
 * Optional fields are marked with '?' and represent data that may or may not
 * be present depending on where the article is in the pipeline.
 */
export interface Article {
  // === Core fields (always present after ingestion) ===
  id: string;
  title: string;
  url: string;
  source: string;
  published_at: string;
  ingested_at: string;
  
  // === Content fields ===
  snippet?: string;
  aiSummary?: string; // AI-generated summary
  summary?: string; // Alternative summary field (used in classification)
  oneSentenceSummary?: string; // One-line summary variant
  
  // === Discovery fields ===
  discoveredAt?: string; // ISO timestamp when article was discovered/extracted
  publishedDateInvalid?: boolean; // True if published_at is invalid/missing
  usedDiscoveredAtFallback?: boolean; // True if included via discoveredAt fallback
  sourceType?: ArticleSourceType; // How article was ingested
  categoryHint?: CategoryHint; // Optional hint from RSS source (non-binding)
  publishedAt?: string | null; // Extracted published date (nullable)
  dateSource?: DateSource; // html | tavily | none
  dateSourceDetail?: DateSourceDetail; // jsonld | meta | time | tavily | none
  dateConfidence?: DateConfidence; // high | medium | low
  
  // === Ranking/scoring fields ===
  relevance?: RelevanceScore; // Full relevance score breakdown
  rerankWhy?: string; // LLM explanation for ranking position
  rerankConfidence?: number; // LLM confidence in ranking (0-1)
  
  // === Filtering/quality fields ===
  paywalled?: boolean; // True if article is behind paywall
  hasFullText?: boolean; // True if full text was extracted
  
  // === i18n translations (populated at digest build time) ===
  translations?: {
    da?: { title?: string; summary?: string };
    es?: { title?: string; summary?: string };
  };

  // === Competitor intelligence (populated by competitorAnalyze pipeline step) ===
  signalTag?: SignalTag; // Competitor signal classification
}

/**
 * Article with guaranteed relevance score (used after scoring)
 */
export interface ArticleWithRelevance extends Article {
  relevance?: RelevanceScore;
}
