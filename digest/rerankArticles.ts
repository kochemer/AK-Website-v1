/**
 * LLM-based article reranking for weekly digest Top 7 selection.
 * 
 * Replaces deterministic selection with LLM-based selection that considers:
 * - Relevance to category
 * - Diversity of sources
 * - Quality and newsworthiness
 * - Recency
 * 
 * Features:
 * - Deterministic (temperature 0)
 * - Cached by weekLabel + category + candidate hash
 * - Bounded cost (only sends title, source, date, snippet, score)
 * - Failure-safe (falls back to deterministic top 7)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import OpenAI from 'openai';
import type { Topic } from '../classification/classifyTopics';
import { getTopicDisplayName } from '../utils/topicNames';
import type { Article as BaseArticle } from '../classification/classifyTopics';
import { computeCommerceMateriality } from '../scoring/commerceMateriality';

// Extended Article type that includes snippet (used in actual data)
type Article = BaseArticle & {
  snippet?: string;
};

type CandidateArticle = {
  id: string; // index in candidate array (0-based)
  title: string;
  source: string;
  date: string;
  snippet?: string;
  url: string; // for deduplication check
  flags?: {
    sponsored?: boolean;
    pressRelease?: boolean;
    controversialSuspected?: boolean;
  };
  tier?: "high" | "med" | "low"; // Optional category-match tier (not for ranking)
  commerceMaterialityScore?: number; // For scoring/trimming, not sent to LLM
  commerceMaterialitySignals?: string[]; // For scoring/trimming, not sent to LLM
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const RERANK_MODEL_PRIMARY = process.env.RERANKER_MODEL_PRIMARY || process.env.RERANK_MODEL || 'gpt-4o-mini';
const RERANK_MODEL_FALLBACK = process.env.RERANKER_MODEL_FALLBACK || 'gpt-4.1-mini';
const TEMPERATURE = 0; // Deterministic
const MAX_TOKENS = 2000;
const CACHE_FILE = path.join(__dirname, '../data/rerank_cache.json');
const CANDIDATE_DEFAULT = 100; // Default candidate pool size
const CANDIDATE_MIN = 25;
const CANDIDATE_MAX = 100;
const SNIPPET_MAX_LENGTH = 350; // Truncate snippets to bound cost

// TPM-safe configuration
const RERANK_MAX_ITEMS = parseInt(process.env.RERANK_MAX_ITEMS || '18', 10);
const RERANK_MAX_CHARS = parseInt(process.env.RERANK_MAX_CHARS || '10000', 10);
const RERANK_COOLDOWN_MS = parseInt(process.env.RERANK_COOLDOWN_MS || '6500', 10);

// Helper: sleep function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Commerce Materiality weights for reranking
const COMMERCE_MATERIALITY_WEIGHT_ECOM = parseFloat(process.env.COMMERCE_MATERIALITY_WEIGHT_ECOM || '1.5');
const COMMERCE_MATERIALITY_WEIGHT_EMAIL = parseFloat(process.env.COMMERCE_MATERIALITY_WEIGHT_EMAIL || '1.2');
const COMMERCE_MATERIALITY_WEIGHT_OTHER = parseFloat(process.env.COMMERCE_MATERIALITY_WEIGHT_OTHER || '0.3');

// Types
type RerankResult = {
  id: string;
  rank: number;
  why: string;
  confidence: number;
};

type RerankResponse = {
  selected: RerankResult[];
};

type CacheEntry = {
  selected: RerankResult[];
  cached_at: string;
  model: string;
};

type RerankCache = {
  [key: string]: CacheEntry;
};

type CategoryRerankStats = {
  category: string;
  total_available: number;
  candidates_count: number;
  selected_count: number;
  cache_hit: boolean;
  skipped: boolean;
  skip_reason?: string;
};

type RerankStats = {
  calls: number;
  cache_hits: number;
  cache_misses: number;
  fallbacks: number;
  total_candidates: number;
  category_stats: CategoryRerankStats[];
};

let stats: RerankStats = {
  calls: 0,
  cache_hits: 0,
  cache_misses: 0,
  fallbacks: 0,
  total_candidates: 0,
  category_stats: [],
};

export function getRerankStats(): RerankStats {
  return { ...stats };
}

export function resetRerankStats(): void {
  stats = {
    calls: 0,
    cache_hits: 0,
    cache_misses: 0,
    fallbacks: 0,
    total_candidates: 0,
    category_stats: [],
  };
}

// Cache management
async function loadCache(): Promise<RerankCache> {
  try {
    const content = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return {};
    }
    console.warn(`[Reranker] Failed to load cache: ${err.message}`);
    return {};
  }
}

async function saveCache(cache: RerankCache): Promise<void> {
  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn(`[Reranker] Failed to save cache: ${err.message}`);
  }
}

/**
 * Create a deterministic fingerprint of candidates for cache key.
 * Sorts by URL first to ensure deterministic ordering.
 */
function fingerprintCandidates(candidates: CandidateArticle[]): string {
  // Sort candidates deterministically by URL (stable field)
  const sorted = [...candidates].sort((a, b) => a.url.localeCompare(b.url));
  
  // Extract stable fields for fingerprinting
  const candidateData = sorted.map(c => ({
    url: c.url, // required - primary identifier
    title: c.title || '', // optional but stable
    date: c.date || '', // optional but stable
    snippet: truncateSnippet(c.snippet, SNIPPET_MAX_LENGTH) || '', // optional, truncated consistently
  }));
  
  // Create hash from stable fields
  const hash = crypto.createHash('md5')
    .update(JSON.stringify(candidateData))
    .digest('hex')
    .slice(0, 12);
  
  return hash;
}

function getCacheKey(weekLabel: string, category: Topic, candidates: CandidateArticle[]): string {
  const fingerprint = fingerprintCandidates(candidates);
  return `${weekLabel}:${category}:${fingerprint}`;
}

function truncateSnippet(snippet: string | undefined, maxLength: number): string {
  if (!snippet) return '';
  if (snippet.length <= maxLength) return snippet;
  return snippet.substring(0, maxLength - 3) + '...';
}

/**
 * Score candidate for deterministic trimming (retail relevance + recency + source priority)
 */
function scoreCandidateForTrimming(candidate: CandidateArticle): number {
  let score = 0;
  const text = `${candidate.title} ${candidate.snippet || ''}`.toLowerCase();
  
  // Retail relevance keywords
  const retailKeywords = [
    "retail", "ecommerce", "e-commerce", "shopping", "checkout", "cart", "payment", "merchant",
    "store", "brand", "customer", "commerce", "marketplace", "fulfillment", "logistics",
    "luxury", "fashion", "jewelry", "jewellery", "watch", "pricing", "conversion", "revenue",
    "platform", "shopify", "amazon", "walmart", "omnichannel", "supply chain"
  ];
  
  // Count retail keyword matches
  const retailMatches = retailKeywords.filter(kw => text.includes(kw)).length;
  score += retailMatches * 10;
  
  // Source priority (high-quality sources get boost)
  const highQualitySources = ["mckinsey", "bain", "bcg", "ft", "bloomberg", "wsj", "economist"];
  if (highQualitySources.some(src => candidate.source.toLowerCase().includes(src))) {
    score += 5;
  }
  
  // Recency (newer is better, but all are from same week so minimal impact)
  // Parse date and give slight boost to more recent
  try {
    const date = new Date(candidate.date);
    if (!isNaN(date.getTime())) {
      score += 1; // Minimal recency boost
    }
  } catch {
    // Ignore date parsing errors
  }
  
  return score;
}

/**
 * Trim candidates to fit within budget (max items and max chars)
 */
function trimCandidatesToBudget(candidates: CandidateArticle[]): {
  trimmed: CandidateArticle[];
  totalChars: number;
} {
  if (candidates.length <= RERANK_MAX_ITEMS) {
    // Check char budget
    let totalChars = 0;
    const trimmed: CandidateArticle[] = [];
    
    for (const candidate of candidates) {
      const candidateStr = `${candidate.id}|${candidate.title}|${candidate.source}|${candidate.date}|${candidate.url}|${candidate.snippet || ''}`;
      const candidateChars = candidateStr.length;
      
      if (totalChars + candidateChars <= RERANK_MAX_CHARS) {
        trimmed.push(candidate);
        totalChars += candidateChars;
      } else {
        break; // Can't fit more
      }
    }
    
    return { trimmed, totalChars };
  }
  
  // First, score and sort by score (highest first)
  const scored = candidates.map(c => ({
    candidate: c,
    score: scoreCandidateForTrimming(c)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  // Take top RERANK_MAX_ITEMS
  const topItems = scored.slice(0, RERANK_MAX_ITEMS).map(s => s.candidate);
  
  // Then trim to char budget by dropping lowest-scored items
  let totalChars = 0;
  const trimmed: CandidateArticle[] = [];
  
  for (const candidate of topItems) {
    const candidateStr = `${candidate.id}|${candidate.title}|${candidate.source}|${candidate.date}|${candidate.url}|${candidate.snippet || ''}`;
    const candidateChars = candidateStr.length;
    
    if (totalChars + candidateChars <= RERANK_MAX_CHARS) {
      trimmed.push(candidate);
      totalChars += candidateChars;
    } else {
      break; // Can't fit more
    }
  }
  
  return { trimmed, totalChars };
}

function buildRerankPrompt(
  category: Topic,
  categoryDisplayName: string,
  candidates: CandidateArticle[]
): string {
  // Build minimal payload: id, title, source, date, url, 1-sentence summary
  const candidateList = candidates.map((c, idx) => {
    // Create 1-sentence summary from snippet (truncate to ~100 chars for 1 sentence)
    let summary = '';
    if (c.snippet) {
      const truncated = truncateSnippet(c.snippet, 100);
      // Take first sentence or first 100 chars
      const firstSentence = truncated.split(/[.!?]/)[0];
      summary = firstSentence.length > 0 ? firstSentence.trim() : truncated.substring(0, 100).trim();
    }
    
    return `${idx}. ${c.title}
   Source: ${c.source}
   Date: ${c.date}
   ${summary ? `Summary: ${summary}` : ''}
   URL: ${c.url}`;
  }).join('\n\n');

  const targetCount = Math.min(7, candidates.length);
  const isSmallCategory = candidates.length >= 2 && candidates.length < 7;
  
  return `You are selecting articles for a weekly brief in the "${categoryDisplayName}" category.

Your goal is to select and rank the ${targetCount} article${targetCount > 1 ? 's' : ''} for Pandora colleagues interested in retail/ecommerce intelligence.

${isSmallCategory 
  ? `IMPORTANT: This category has only ${candidates.length} candidate${candidates.length > 1 ? 's' : ''}. You MUST select ALL ${candidates.length} of them, ordered by importance (ranks 1-${candidates.length}).`
  : `Select the top ${targetCount} articles from the candidates below, ordered by importance (ranks 1-${targetCount}).`}

SELECTION CRITERIA (priority order):

A) RELEVANCE TO PANDORA COLLEAGUES (highest priority)
   Prioritize articles with practical implications for retail/ecommerce:
   - Customer experience (CX), conversion optimization
   - CRM/loyalty programs, customer retention
   - Merchandising, product assortment, inventory
   - Pricing/promotions, margin management
   - Supply chain, logistics, fulfillment
   - Store operations and digital commerce integration
   - Analytics, experimentation, measurement
   - AI productivity tools and governance

B) RELEVANCE TO RETAIL/FASHION ECOMMERCE LANDSCAPE
   - Must connect to commerce; deprioritize generic tech unless clearly applied to retail
   - Focus on actionable insights for retail professionals

B1) COMMERCE MATERIALITY (especially for Ecommerce & Retail Tech category)
   - Prefer articles with high commerce materiality (real execution impact: platform capabilities, checkout/cart changes, retailer adoption, monetization changes)
   - Articles with high "Commerce Materiality" scores indicate real-world commerce execution impact rather than commentary/discourse
   - When relevance is similar, prioritize high materiality articles
   - Low materiality (0-2/10) often indicates discourse-only content without deployment

C) INSIGHTFULNESS
   Prefer articles with:
   - New data, benchmarks, metrics
   - Case studies with measurable outcomes
   - Strong analysis and non-obvious takeaways
   - Concrete examples and real-world applications
   Avoid:
   - Thin rewrites or summaries
   - Pure announcements without analysis
   - Vendor marketing without substance
   - Generic thought leadership

D) CONTROVERSY FILTER (hard constraint - EXCLUDE these)
   Do NOT select articles primarily about:
   - War/armed conflict/violence (unless directly about retail supply chain impact)
   - Culture-war/polarizing identity politics
   - Election horse-race politics
   EXCEPTION: Allow policy/regulation with DIRECT retail/ecommerce/AI impact:
   - Tariffs, trade policy affecting retail pricing/supply chain
   - AI compliance laws (AI Act, GDPR, privacy regulation)
   - Platform regulation with direct commerce impact
   - Consumer protection laws affecting retail
   Articles marked [CONTROVERSY FLAGGED - REVIEW] should be carefully evaluated against this filter.

E) RECENCY
   - All articles are from the same week; treat Monday and Friday equally
   - No intra-week recency bias - all in-week articles are equally recent

CONSTRAINTS:
- Select exactly ${targetCount} article${targetCount > 1 ? 's' : ''} (or fewer if fewer eligible candidates)
- Max 2 articles per source (enforce source diversity)
- Avoid duplicates/near-duplicates of the same story/topic
- Never select duplicates (check URLs if provided)

Candidate articles (all eligible - no numeric scores provided):
${candidateList}

Return a JSON object with this exact structure:
{
  "selected": [
    { "id": "0", "rank": 1, "why": "brief concrete reason (5-15 words)", "confidence": 0.9 },
    { "id": "1", "rank": 2, "why": "brief concrete reason (5-15 words)", "confidence": 0.85 },
    ...
  ]
}

Rules:
- "id" must match the candidate number (0, 1, 2, ...)
- "rank" must be 1-N, unique, sequential (where N = number of candidates to select)
- "why" should be a short phrase (5-15 words) explaining why this article was selected - be concrete and specific
- "confidence" should be 0.0-1.0
- CRITICAL: Selection count must match exactly:
  - You must return exactly ${targetCount} item${targetCount > 1 ? 's' : ''} in the "selected" array
${isSmallCategory ? `- For this small category with ${candidates.length} candidates, select ALL ${candidates.length} candidates (ids 0-${candidates.length - 1})` : ''}
  - Never select fewer than ${targetCount}
  - Never select more than 7 total

Respond with ONLY valid JSON, no markdown, no code blocks, just raw JSON.`;
}

/**
 * Check if error is RPD (requests per day) or TPM (tokens per minute) rate limit
 */
function isRPDorTPMError(err: any): boolean {
  const message = err.message || '';
  return message.includes('requests per day (RPD)') || message.includes('tokens per min (TPM)');
}

/**
 * Call OpenAI with retry logic for 429/transient errors
 * Returns response and whether to switch models (on RPD/TPM errors)
 */
async function callOpenAIWithRetry(
  openai: OpenAI,
  request: Parameters<typeof openai.chat.completions.create>[0],
  category: string,
  weekLabel: string,
  model: string,
  maxRetries: number = 8
): Promise<{ response: Awaited<ReturnType<typeof openai.chat.completions.create>>; shouldSwitchModel: boolean }> {
  let lastError: Error | null = null;
  let shouldSwitchModel = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Reranker] ${weekLabel}/${category} [${model}]: Retrying attempt ${attempt}/${maxRetries}`);
      }
      const response = await openai.chat.completions.create(request);
      if (attempt > 0) {
        console.log(`[Reranker] ${weekLabel}/${category} [${model}]: Succeeded after ${attempt} retries`);
      }
      // Type assertion: we're not using streams, so this will always be ChatCompletion
      return { response: response as any, shouldSwitchModel: false };
    } catch (err: any) {
      lastError = err;

      const isRateLimit = err.status === 429 || err.message?.includes('429') || err.message?.includes('rate limit');
      const isTransient = err.status >= 500 || err.message?.includes('timeout') || err.message?.includes('network');

      if (!isRateLimit && !isTransient) {
        throw err; // Non-retryable error
      }

      // If RPD/TPM error on first attempt, signal to switch to fallback model immediately
      if (isRateLimit && isRPDorTPMError(err) && attempt === 0) {
        shouldSwitchModel = true;
        throw err; // Exit immediately to switch models
      }

      if (attempt >= maxRetries) {
        break;
      }

      let baseWait = Math.min(1500 * Math.pow(2, attempt), 12000);
      const jitter = Math.floor(Math.random() * 300);
      let waitMs = baseWait + jitter;

      const retryAfterMatch = err.message?.match(/Please try again in (\d+)ms/i);
      if (retryAfterMatch) {
        const retryAfterMs = parseInt(retryAfterMatch[1], 10);
        waitMs = Math.max(waitMs, retryAfterMs);
      }

      console.warn(`[Reranker] ${weekLabel}/${category} [${model}]: API error (attempt ${attempt}/${maxRetries}), waiting ${waitMs}ms: ${err.message}`);
      await sleep(waitMs);
    }
  }

  throw lastError || new Error('OpenAI API call failed after retries');
}

async function callRerankLLM(
  category: Topic,
  categoryDisplayName: string,
  candidates: CandidateArticle[],
  weekLabel: string
): Promise<{ response: RerankResponse | null; modelUsed: string }> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.warn(`[Reranker] OPENAI_API_KEY not found, skipping LLM rerank`);
    return { response: null, modelUsed: '' };
  }

  const prompt = buildRerankPrompt(category, categoryDisplayName, candidates);
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  
  // Try PRIMARY model first
  let currentModel = RERANK_MODEL_PRIMARY;
  let modelUsed = '';
  
  for (let modelAttempt = 0; modelAttempt < 2; modelAttempt++) {
    try {
      // Apply cooldown before each call
      await sleep(RERANK_COOLDOWN_MS);
      
      const request: Parameters<typeof openai.chat.completions.create>[0] = {
        model: currentModel,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: 'system',
            content: 'You are a precise article selector. Always respond with valid JSON only, no markdown formatting, no code blocks, just raw JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        ...(currentModel.includes('gpt-4') || currentModel.includes('1106') || currentModel.includes('o-mini') || currentModel.includes('4.1')
          ? { response_format: { type: 'json_object' } as const }
          : {}),
      };
      
      const result = await callOpenAIWithRetry(openai, request, category, weekLabel, currentModel, 8);
      modelUsed = currentModel;

      if (result.shouldSwitchModel && modelAttempt === 0 && currentModel === RERANK_MODEL_PRIMARY) {
        console.warn(`[Reranker] ${weekLabel}/${category}: PRIMARY model [${currentModel}] hit RPD/TPM limit, switching to FALLBACK [${RERANK_MODEL_FALLBACK}]`);
        currentModel = RERANK_MODEL_FALLBACK;
        continue; // Retry with fallback model
      }

      const response = result.response;

      if (!response) {
        console.warn(`[Reranker] Empty response from LLM [${currentModel}]`);
        if (modelAttempt === 0 && currentModel === RERANK_MODEL_PRIMARY) {
          currentModel = RERANK_MODEL_FALLBACK;
          continue;
        }
        return { response: null, modelUsed: '' };
      }

      // Type guard: ensure response is not a stream
      if (!('choices' in response)) {
        console.warn(`[Reranker] Unexpected response type from LLM [${currentModel}]`);
        if (modelAttempt === 0 && currentModel === RERANK_MODEL_PRIMARY) {
          currentModel = RERANK_MODEL_FALLBACK;
          continue;
        }
        return { response: null, modelUsed: '' };
      }

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        console.warn(`[Reranker] Empty response from LLM [${currentModel}]`);
        if (modelAttempt === 0 && currentModel === RERANK_MODEL_PRIMARY) {
          // Try fallback model
          currentModel = RERANK_MODEL_FALLBACK;
          continue;
        }
        return { response: null, modelUsed: '' };
      }

      // Parse JSON response
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (parseErr) {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          throw parseErr;
        }
      }

      // Validate response schema
      if (!parsed.selected || !Array.isArray(parsed.selected)) {
        console.warn(`[Reranker] Invalid response structure from LLM [${currentModel}]`);
        if (modelAttempt === 0 && currentModel === RERANK_MODEL_PRIMARY) {
          // Try fallback model
          currentModel = RERANK_MODEL_FALLBACK;
          continue;
        }
        return { response: null, modelUsed: '' };
      }

      console.log(`[Reranker] ${weekLabel}/${category}: Successfully used model [${modelUsed}]`);
      return { response: parsed as RerankResponse, modelUsed };
    } catch (err: any) {
      const isRPDorTPM = isRPDorTPMError(err);
      const isRateLimit = err.status === 429 || err.message?.includes('429') || err.message?.includes('rate limit');
      
      // If RPD/TPM error on PRIMARY, switch to FALLBACK immediately
      if (modelAttempt === 0 && currentModel === RERANK_MODEL_PRIMARY && isRateLimit && isRPDorTPM) {
        console.warn(`[Reranker] ${weekLabel}/${category}: PRIMARY model [${RERANK_MODEL_PRIMARY}] hit RPD/TPM limit, switching to FALLBACK [${RERANK_MODEL_FALLBACK}]`);
        currentModel = RERANK_MODEL_FALLBACK;
        continue; // Try fallback model
      }
      
      // If fallback also fails, or non-RPD/TPM error, return null
      console.warn(`[Reranker] ${weekLabel}/${category}: LLM call failed [${currentModel}]: ${err.message}`);
      if (modelAttempt === 0 && currentModel === RERANK_MODEL_PRIMARY && !isRPDorTPM) {
        // For non-RPD/TPM errors, try fallback once
        currentModel = RERANK_MODEL_FALLBACK;
        continue;
      }
      return { response: null, modelUsed: '' };
    }
  }
  
  // Both models failed
  return { response: null, modelUsed: '' };
}

function validateRerankResponse(
  response: RerankResponse,
  candidates: CandidateArticle[]
): { valid: boolean; error?: string } {
  const selected = response.selected;
  if (!selected || !Array.isArray(selected)) {
    return { valid: false, error: 'Missing or invalid selected array' };
  }

  // Check for exactly 7 items (or fewer if fewer candidates)
  const expectedCount = Math.min(7, candidates.length);
  if (selected.length !== expectedCount) {
    return { valid: false, error: `Expected ${expectedCount} items, got ${selected.length}` };
  }

  // Validate IDs exist and are unique
  const ids = new Set<string>();
  const ranks = new Set<number>();
  const urls = new Set<string>();

  for (const item of selected) {
    // Check ID exists
    const idNum = parseInt(item.id, 10);
    if (isNaN(idNum) || idNum < 0 || idNum >= candidates.length) {
      return { valid: false, error: `Invalid id: ${item.id}` };
    }

    // Check rank is valid
    if (item.rank < 1 || item.rank > 7) {
      return { valid: false, error: `Invalid rank: ${item.rank}` };
    }

    // Check for duplicates
    if (ids.has(item.id)) {
      return { valid: false, error: `Duplicate id: ${item.id}` };
    }
    if (ranks.has(item.rank)) {
      return { valid: false, error: `Duplicate rank: ${item.rank}` };
    }

    // Check for duplicate URLs
    const candidate = candidates[idNum];
    if (urls.has(candidate.url)) {
      return { valid: false, error: `Duplicate URL: ${candidate.url}` };
    }

    ids.add(item.id);
    ranks.add(item.rank);
    urls.add(candidate.url);
  }

  // Check ranks are sequential 1..N
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  for (let i = 0; i < sortedRanks.length; i++) {
    if (sortedRanks[i] !== i + 1) {
      return { valid: false, error: `Ranks not sequential: ${sortedRanks.join(', ')}` };
    }
  }

  return { valid: true };
}

function getCategoryDisplayName(category: Topic): string {
  return getTopicDisplayName(category);
}

/**
 * Rerank articles using LLM with caching and fallback.
 * 
 * @param weekLabel - Week label (e.g., "2026-W01")
 * @param category - Topic category
 * @param totalAvailable - Total articles available in category (for logging)
 * @param candidates - Candidate articles with deterministic scores
 * @param fallbackSelect - Fallback function to use if LLM fails
 * @returns Selected articles in reranked order
 */
export async function rerankArticles<T extends Article & { snippet?: string }>(
  weekLabel: string,
  category: Topic,
  totalAvailable: number,
  candidates: T[],
  fallbackSelect: (articles: T[]) => T[]
): Promise<{
  selected: T[];
  explainability?: Array<{ rerankWhy?: string; rerankConfidence?: number }>;
  fromCache: boolean;
  fromFallback: boolean;
}> {
  const categoryKey = category;
  let categoryStat: CategoryRerankStats = {
    category: categoryKey,
    total_available: totalAvailable,
    candidates_count: candidates.length,
    selected_count: 0,
    cache_hit: false,
    skipped: false,
  };

  // If no candidates, skip
  if (candidates.length === 0) {
    categoryStat.skipped = true;
    categoryStat.skip_reason = 'no candidates';
    stats.category_stats.push(categoryStat);
    return {
      selected: [],
      fromCache: false,
      fromFallback: true,
    };
  }

  // If single candidate, skip (no meaningful rerank)
  if (candidates.length === 1) {
    const selected = fallbackSelect(candidates);
    categoryStat.selected_count = selected.length;
    categoryStat.skipped = true;
    categoryStat.skip_reason = 'single candidate';
    stats.category_stats.push(categoryStat);
    return {
      selected,
      fromCache: false,
      fromFallback: true,
    };
  }

  // For 2-6 candidates, allow reranking (will return all candidates, max 7)
  // For 7+ candidates, rerank and return top 7

  // Compute commerce materiality scores for all candidates
  const materialityScores = new Map<string, { score: number; signals: string[] }>();
  for (const article of candidates) {
    const materiality = computeCommerceMateriality({
      title: article.title,
      source: article.source,
      snippet: article.snippet,
      aiSummary: (article as any).aiSummary
    });
    materialityScores.set(article.url, {
      score: materiality.score,
      signals: materiality.signals
    });
  }
  
  // Build candidate list with bounded fields (no scores, just flags and metadata)
  const candidateList: CandidateArticle[] = candidates.map((article, idx) => {
    const gate = (article as any).gate;
    const materiality = materialityScores.get(article.url);
    return {
      id: idx.toString(),
      title: article.title,
      source: article.source,
      date: article.published_at ? new Date(article.published_at).toLocaleDateString() : '',
      snippet: article.snippet,
      url: article.url,
      flags: gate?.flags ? {
        sponsored: gate.flags.sponsored,
        pressRelease: gate.flags.pressRelease,
        controversialSuspected: gate.flags.controversialSuspected,
      } : undefined,
      tier: gate?.tier,
      commerceMaterialityScore: materiality?.score,
      commerceMaterialitySignals: materiality?.signals,
    };
  });

  stats.total_candidates += candidateList.length;

  // Check cache
  const cacheKey = getCacheKey(weekLabel, category, candidateList);
  const fingerprint = fingerprintCandidates(candidateList);
  const cache = await loadCache();
  const cached = cache[cacheKey];
  
  // Debug logging
  const DEBUG = process.env.RERANK_DEBUG === 'true';
  if (DEBUG) {
    console.log(`[Reranker Debug] ${category}: fingerprint=${fingerprint.slice(0, 8)}, cacheKey=${cacheKey.slice(0, 50)}... ${cached ? 'HIT' : 'MISS'}`);
  }

  // Accept cache if it matches either PRIMARY or FALLBACK model (for backward compatibility)
  if (cached && (cached.model === RERANK_MODEL_PRIMARY || cached.model === RERANK_MODEL_FALLBACK)) {
    stats.cache_hits++;
    categoryStat.cache_hit = true;
    // Map cached results back to articles
    const selected = cached.selected
      .sort((a, b) => a.rank - b.rank)
      .map(item => {
        const idx = parseInt(item.id, 10);
        return candidates[idx];
      })
      .filter(Boolean) as T[];

    const explainability = cached.selected
      .sort((a, b) => a.rank - b.rank)
      .map(item => ({
        rerankWhy: item.why,
        rerankConfidence: item.confidence,
      }));

    categoryStat.selected_count = selected.length;
    stats.category_stats.push(categoryStat);

    return {
      selected,
      explainability,
      fromCache: true,
      fromFallback: false,
    };
  }

  stats.cache_misses++;
  stats.calls++;

  // Trim candidates to fit within budget (max items and max chars)
  const { trimmed: trimmedCandidates, totalChars } = trimCandidatesToBudget(candidateList);
  
  console.log(`[Reranker] ${weekLabel}/${category}: candidates=${candidateList.length}, items_sent=${trimmedCandidates.length}, chars_sent=${totalChars}, cooldown_ms=${RERANK_COOLDOWN_MS}`);

  // Call LLM (with model failover)
  const categoryDisplayName = getCategoryDisplayName(category);
  let llmResponse: RerankResponse | null = null;
  let modelUsed = '';
  
  try {
    const result = await callRerankLLM(category, categoryDisplayName, trimmedCandidates, weekLabel);
    llmResponse = result.response;
    modelUsed = result.modelUsed;
  } catch (err: any) {
    console.warn(`[Reranker] ${weekLabel}/${category}: LLM call failed after both models, using fallback: ${err.message}`);
  }
  
  if (!llmResponse) {
    console.log(`[Reranker] ${weekLabel}/${category}: fallback (both models exhausted)`);
  }

  if (!llmResponse) {
    console.warn(`[Reranker] LLM call failed for ${weekLabel}/${category}, using fallback`);
    stats.fallbacks++;
    const selected = fallbackSelect(candidates);
    categoryStat.selected_count = selected.length;
    categoryStat.skip_reason = 'LLM call failed';
    stats.category_stats.push(categoryStat);
    return {
      selected,
      fromCache: false,
      fromFallback: true,
    };
  }

  // Validate response (using trimmed candidates for validation)
  const validation = validateRerankResponse(llmResponse, trimmedCandidates);
  if (!validation.valid) {
    console.warn(`[Reranker] Invalid LLM response for ${weekLabel}/${category}: ${validation.error}, using fallback`);
    stats.fallbacks++;
    const selected = fallbackSelect(candidates);
    categoryStat.selected_count = selected.length;
    categoryStat.skip_reason = `Invalid response: ${validation.error}`;
    stats.category_stats.push(categoryStat);
    return {
      selected,
      fromCache: false,
      fromFallback: true,
    };
  }

  // Map results back to articles (using original candidates array, not trimmed)
  // Need to map from trimmed candidate indices back to original candidate indices
  const trimmedToOriginal = new Map<number, number>();
  trimmedCandidates.forEach((trimmed, idx) => {
    const originalIdx = candidateList.findIndex(c => c.url === trimmed.url);
    if (originalIdx >= 0) {
      trimmedToOriginal.set(idx, originalIdx);
    }
  });
  
  let selected = llmResponse.selected
    .sort((a, b) => a.rank - b.rank)
    .map(item => {
      const trimmedIdx = parseInt(item.id, 10);
      const originalIdx = trimmedToOriginal.get(trimmedIdx);
      if (originalIdx === undefined) return null;
      return candidates[originalIdx];
    })
    .filter(Boolean) as T[];

  // Apply commerce materiality boost to rerank within selected articles
  // Determine weight based on category
  let materialityWeight = COMMERCE_MATERIALITY_WEIGHT_OTHER;
  if (category === 'Ecommerce_Retail_Tech') {
    materialityWeight = COMMERCE_MATERIALITY_WEIGHT_ECOM;
  } else if (category === 'AI_and_Strategy') {
    // Dial back materiality for AI category - focus on AI strategy, not commerce execution
    materialityWeight = 0.1; // Very low weight for AI category
  } else if (category === 'Luxury_and_Consumer' || category === 'Jewellery_Industry') {
    materialityWeight = COMMERCE_MATERIALITY_WEIGHT_EMAIL;
  }
  
  // Create articles with combined scores (LLM rank + materiality boost)
  const articlesWithScores = selected.map((article, idx) => {
    const materiality = materialityScores.get(article.url);
    const materialityScore = materiality?.score || 0;
    const llmRank = idx + 1; // Lower is better
    const materialityBoost = materialityScore * materialityWeight;
    const combinedScore = llmRank - materialityBoost; // Lower is better (subtract boost)
    
    return {
      article,
      combinedScore,
      materialityScore
    };
  });
  
  // Re-sort by combined score (lower is better)
  articlesWithScores.sort((a, b) => a.combinedScore - b.combinedScore);
  
  // Extract re-ranked articles
  selected = articlesWithScores.map(item => item.article);

  const explainability = llmResponse.selected
    .sort((a, b) => a.rank - b.rank)
    .map(item => ({
      rerankWhy: item.why,
      rerankConfidence: item.confidence,
    }));

  // Save to cache
  cache[cacheKey] = {
    selected: llmResponse.selected,
    cached_at: new Date().toISOString(),
    model: modelUsed || RERANK_MODEL_PRIMARY, // Use the model that was actually used
  };
  await saveCache(cache);

  categoryStat.selected_count = selected.length;
  stats.category_stats.push(categoryStat);

  return {
    selected,
    explainability,
    fromCache: false,
    fromFallback: false,
  };
}

