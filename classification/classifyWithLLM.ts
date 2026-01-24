/**
 * LLM-based article classifier with caching and deterministic output.
 * Falls back to rule-based classification on failure.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import OpenAI from 'openai';
import type { Topic } from './classifyTopics';
import { classifyTopic } from './classifyTopics';

// --- Configuration ---

const CLASSIFIER_VERSION = 'llm-v2'; // Updated version for frontier AI focus
const CLASSIFIER_MODEL = process.env.CLASSIFIER_MODEL || 'gpt-4o-mini';
const TEMPERATURE = 0; // Deterministic
const MAX_TOKENS = 150;
const CONFIDENCE_THRESHOLD = 0.55; // If LLM confidence < this, use keyword fallback
const CACHE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/classification_cache.json');
const DRY_RUN = process.env.CLASSIFIER_DRY_RUN === 'true';
const CLASSIFIER_MAX_CHARS = parseInt(process.env.CLASSIFIER_MAX_CHARS || '6000', 10);
const CLASSIFIER_COOLDOWN_MS = parseInt(process.env.CLASSIFIER_COOLDOWN_MS || '2000', 10);

// Track if we've hit a rate limit (for cooldown before next article)
let hasHitRateLimit = false;

// --- Types ---

export type ClassificationResult = {
  category: Topic;
  confidence: number; // 0-1
  rationale?: string;
  classifier_version: string;
  from_cache: boolean;
  from_fallback: boolean;
};

type CacheEntry = {
  category: Topic;
  confidence: number;
  rationale?: string;
  classifier_version: string;
  cached_at: string;
};

type ClassificationCache = {
  [url: string]: CacheEntry;
};

// --- Cache Management ---

async function loadCache(): Promise<ClassificationCache> {
  try {
    const content = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      // Cache file doesn't exist yet, return empty cache
      return {};
    }
    console.warn(`[Classifier] Failed to load cache: ${err.message}`);
    return {};
  }
}

async function saveCache(cache: ClassificationCache): Promise<void> {
  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn(`[Classifier] Failed to save cache: ${err.message}`);
  }
}

function getCacheKey(article: { url: string; title: string; snippet?: string }): string {
  // Use canonical URL as primary key
  // Normalize URL: remove trailing slashes, convert to lowercase for domain
  try {
    const urlObj = new URL(article.url);
    const normalizedUrl = `${urlObj.protocol}//${urlObj.hostname.toLowerCase()}${urlObj.pathname.replace(/\/$/, '')}${urlObj.search}`;
    
    // Optional: add hash of title+snippet to detect content changes
    // For now, we'll use URL only for simplicity (can be enhanced later)
    return normalizedUrl;
  } catch {
    // If URL parsing fails, use original URL
    return article.url;
  }
}

// --- Input Truncation Helper ---

/**
 * Build classifier input with truncation for LLM prompt only
 * Does NOT modify the stored article content
 */
function buildClassifierInput(article: { 
  title: string; 
  source: string; 
  snippet?: string; 
  published_at?: string;
  url?: string;
  body?: string;
  extractedText?: string;
  aiSummary?: string;
}): {
  title: string;
  source: string;
  publishedDate: string;
  url: string;
  excerpt: string;
  body: string;
} {
  const title = article.title || '';
  const source = article.source || '';
  const publishedDate = article.published_at 
    ? new Date(article.published_at).toLocaleDateString() 
    : '';
  const url = article.url || '';
  
  // Build excerpt from snippet or aiSummary (prefer snippet)
  const excerpt = article.snippet || article.aiSummary || '';
  
  // Get body from extractedText or body field
  const fullBody = article.extractedText || article.body || '';
  
  // Truncate body to max chars, preferring paragraph boundaries
  let body = fullBody;
  if (body.length > CLASSIFIER_MAX_CHARS) {
    // Try to truncate at paragraph boundary
    const truncated = body.substring(0, CLASSIFIER_MAX_CHARS);
    const lastParagraphBreak = truncated.lastIndexOf('\n\n');
    
    if (lastParagraphBreak > CLASSIFIER_MAX_CHARS * 0.7) {
      // If we found a paragraph break in the last 30% of the truncation, use it
      body = truncated.substring(0, lastParagraphBreak);
    } else {
      // Hard cut
      body = truncated;
    }
  }
  
  return {
    title,
    source,
    publishedDate,
    url,
    excerpt,
    body
  };
}

// --- LLM Classification ---

function buildClassificationPrompt(article: { 
  title: string; 
  source: string; 
  snippet?: string; 
  categoryHint?: string;
  published_at?: string;
  url?: string;
  body?: string;
  extractedText?: string;
  aiSummary?: string;
}): string {
  const input = buildClassifierInput(article);
  
  const snippetText = input.excerpt.length > 500 ? input.excerpt.substring(0, 500) + '...' : input.excerpt;
  const bodyText = input.body && input.body.length > 0 
    ? `\n- Body: ${input.body}${input.body.length >= CLASSIFIER_MAX_CHARS ? '...' : ''}` 
    : '';
  const hintText = article.categoryHint ? `\n\nNote: This article comes from a source typically associated with ${article.categoryHint}. Use this as context, but classify based on the article's actual content.` : '';
  
  return `You are a content classifier. Classify this article into exactly ONE of these 4 categories:${hintText}

1. **AI_and_Strategy** (Artificial Intelligence News): Articles about frontier AI research, model development, benchmarks, LLM companies, AI infrastructure, and cutting-edge AI technology. Focus on: model releases, benchmarks (MMLU, GPQA, GSM8K, etc.), training compute, inference costs, AI company news (OpenAI, Anthropic, Google DeepMind, etc.), scaling laws, alignment research, multimodal AI, reasoning capabilities, agent systems. DO NOT include: AI business applications, AI personalization for retail, AI-driven pricing strategies, AI customer service tools (these belong in Ecommerce_Retail_Tech). Examples: "GPT-5 achieves new SOTA on MMLU", "Anthropic raises $4B funding", "New scaling laws for LLM training", "Claude 3.5 Sonnet benchmark results".

2. **Ecommerce_Retail_Tech**: Articles about online shopping, ecommerce platforms, retail technology, checkout systems, payment processing, fulfillment, logistics, omnichannel retail, marketplace platforms, AI applications in retail/ecommerce (personalization, pricing, recommendations, customer service). DO NOT include: Generic IT services, BPO (business process outsourcing), IT outsourcing companies opening centers, generic data analytics services, IT consulting without retail/ecommerce focus, generic AI infrastructure spending by IT services companies. The article MUST mention retail, ecommerce, shopping, checkout, payment, fulfillment, logistics, marketplace, or similar commerce-specific terms. Examples: "Shopify launches new features", "Retail logistics innovation", "Ecommerce conversion optimization", "AI personalization for online stores", "Dynamic pricing algorithms for ecommerce". Counter-examples (DO NOT classify as Ecommerce_Retail_Tech): "IT company opens new data center", "BPO firm expands operations", "IT services company increases AI spending" (unless they explicitly mention retail/ecommerce applications).

3. **Luxury_and_Consumer** (Fashion & Luxury): Articles about luxury brands, fashion brands, consumer goods, high-end retail, luxury market trends, premium products, luxury consumer behavior, fashion industry. DO NOT include: General AI technology, AI model releases, AI infrastructure, AI research (unless specifically about AI applications in luxury/fashion brands). Focus on luxury brands, fashion, consumer goods, and retail - not general AI discourse. Examples: "Luxury consumer spending trends", "Fashion brand strategy", "Luxury brand loyalty", "High-end retail innovations". Counter-examples (DO NOT classify as Luxury_and_Consumer): "New AI model released", "AI infrastructure spending", "LLM benchmark results" (unless explicitly about luxury/fashion AI applications).

4. **Jewellery_Industry**: Articles specifically about jewelry, diamonds, gemstones, watches, luxury jewelry brands (Cartier, Tiffany, Bulgari, etc.), jewelry retail, jewelry manufacturing, horology. Examples: "Diamond market trends", "Cartier launches new collection", "Jewelry industry news", "Luxury watch market analysis".

Article to classify:
- Title: "${input.title}"
- Source: ${input.source}
${input.publishedDate ? `- Published: ${input.publishedDate}` : ''}
${input.url ? `- URL: ${input.url}` : ''}
${snippetText ? `- Description/Snippet: ${snippetText}` : ''}${bodyText}

Respond with ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "category": "AI_and_Strategy" | "Ecommerce_Retail_Tech" | "Luxury_and_Consumer" | "Jewellery_Industry",
  "confidence": 0.85,
  "rationale": "Brief 1-sentence explanation"
}

Choose the category that best fits the article's primary focus. Be precise: if an article is about AI business applications in retail, classify as Ecommerce_Retail_Tech, not AI_and_Strategy.`;
}

/**
 * Check if error is TPM (tokens per minute) or RPD (requests per day) rate limit
 */
function isTPMorRPDError(err: any): boolean {
  const message = err.message || '';
  return message.includes('tokens per min (TPM)') || message.includes('requests per day (RPD)');
}

/**
 * Retry with exponential backoff for OpenAI API calls
 * Returns response and logs retry attempts
 */
async function callOpenAIWithRetry(
  openai: OpenAI,
  request: Parameters<typeof openai.chat.completions.create>[0],
  articleTitle: string,
  maxRetries: number = 6
): Promise<Awaited<ReturnType<typeof openai.chat.completions.create>>> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create(request);
      if (attempt > 0) {
        console.log(`[Classifier] "${articleTitle}...": succeeded after ${attempt} retries`);
      }
      return response;
    } catch (err: any) {
      lastError = err;
      
      // Check if it's a 429 or transient error
      const isRateLimit = err.status === 429 || err.message?.includes('429') || err.message?.includes('rate limit');
      const isTransient = err.status >= 500 || err.message?.includes('timeout') || err.message?.includes('network');
      
      // If this is the first TPM/RPD error, set the flag for cooldown
      if (isRateLimit && isTPMorRPDError(err) && attempt === 0 && !hasHitRateLimit) {
        hasHitRateLimit = true;
      }
      
      if (!isRateLimit && !isTransient) {
        // Not retryable, throw immediately
        throw err;
      }
      
      if (attempt >= maxRetries) {
        // Out of retries
        break;
      }
      
      // Calculate backoff: 500ms * 2^attempt, capped at 8000ms
      let baseWait = Math.min(500 * Math.pow(2, attempt), 8000);
      
      // Add jitter: 0-250ms
      const jitter = Math.floor(Math.random() * 250);
      let waitMs = baseWait + jitter;
      
      // Check if error message contains "Please try again in XXXms"
      const retryAfterMatch = err.message?.match(/Please try again in (\d+)ms/i);
      if (retryAfterMatch) {
        const retryAfterMs = parseInt(retryAfterMatch[1], 10);
        waitMs = Math.max(waitMs, retryAfterMs);
      }
      
      // Log retry attempt
      console.log(`[Classifier] "${articleTitle}...": attempt ${attempt + 1}, waiting ${waitMs}ms`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
  
  // All retries exhausted
  throw lastError || new Error('OpenAI API call failed after retries');
}

async function callLLMClassifier(
  article: { 
    title: string; 
    source: string; 
    snippet?: string; 
    categoryHint?: string;
    published_at?: string;
    url?: string;
    body?: string;
    extractedText?: string;
    aiSummary?: string;
  }
): Promise<{ category: Topic; confidence: number; rationale?: string } | null> {
  if (DRY_RUN) {
    console.log(`[Classifier] DRY RUN: Would classify "${article.title.substring(0, 50)}..."`);
    return null;
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.warn(`[Classifier] OPENAI_API_KEY not found, skipping LLM classification`);
    return null;
  }

  const prompt = buildClassificationPrompt(article);
  const articleTitle = article.title.substring(0, 50);

  // Increment llm_calls counter right before making the API call
  // This ensures we only count actual API calls, not DRY_RUN or missing API key cases
  stats.llm_calls++;

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const request: Parameters<typeof openai.chat.completions.create>[0] = {
      model: CLASSIFIER_MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'system',
          content: 'You are a precise content classifier. Always respond with valid JSON only, no markdown formatting, no code blocks, just raw JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      // Note: response_format works with gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo-1106+
      // For older models, we'll parse the response manually
      ...(CLASSIFIER_MODEL.includes('gpt-4') || CLASSIFIER_MODEL.includes('1106') || CLASSIFIER_MODEL.includes('gpt-4o')
        ? { response_format: { type: 'json_object' } as const }
        : {}),
    };
    
    // Call with retry logic
    const response = await callOpenAIWithRetry(openai, request, articleTitle, 6);

    // Type guard: ensure response is not a stream (it shouldn't be with our request config)
    if (!('choices' in response)) {
      console.warn(`[Classifier] Unexpected response type for article: ${article.title.substring(0, 50)}`);
      return null;
    }

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.warn(`[Classifier] Empty response from LLM for article: ${article.title.substring(0, 50)}`);
      return null;
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
    const category = parsed.category;
    const confidence = parsed.confidence;
    const rationale = parsed.rationale;

    if (!category || typeof category !== 'string') {
      console.warn(`[Classifier] Invalid category in LLM response: ${category}`);
      return null;
    }

    // Validate category is one of the 4 valid topics
    const validTopics: Topic[] = [
      'AI_and_Strategy',
      'Ecommerce_Retail_Tech',
      'Luxury_and_Consumer',
      'Jewellery_Industry',
    ];
    if (!validTopics.includes(category as Topic)) {
      console.warn(`[Classifier] Invalid category value: ${category}`);
      return null;
    }

    // Validate confidence
    let confValue = confidence;
    if (typeof confidence === 'string') {
      // Handle "0.85" as string
      confValue = parseFloat(confidence);
    }
    if (typeof confValue !== 'number' || isNaN(confValue) || confValue < 0 || confValue > 1) {
      // Default to 0.8 if invalid
      confValue = 0.8;
    }

    return {
      category: category as Topic,
      confidence: confValue,
      rationale: typeof rationale === 'string' ? rationale : undefined,
    };
  } catch (err: any) {
    const isRateLimit = err.status === 429 || err.message?.includes('429') || err.message?.includes('rate limit');
    if (isRateLimit) {
      console.warn(`[Classifier] "${articleTitle}...": rate limit after retries, using fallback`);
    } else {
      console.warn(`[Classifier] "${articleTitle}...": API error: ${err.message}`);
    }
    return null;
  }
}

// --- Main Classification Function ---

export type ClassificationStats = {
  total: number;
  cache_hits: number;
  cache_misses: number;
  llm_calls: number;
  llm_successes: number;
  llm_failures: number;
  fallbacks: number;
};

let stats: ClassificationStats = {
  total: 0,
  cache_hits: 0,
  cache_misses: 0,
  llm_calls: 0,
  llm_successes: 0,
  llm_failures: 0,
  fallbacks: 0,
};

export function getClassificationStats(): ClassificationStats {
  return { ...stats };
}

export function resetClassificationStats(): void {
  stats = {
    total: 0,
    cache_hits: 0,
    cache_misses: 0,
    llm_calls: 0,
    llm_successes: 0,
    llm_failures: 0,
    fallbacks: 0,
  };
}

export async function classifyArticleLLM(
  article: { 
    title: string; 
    url: string; 
    source: string; 
    snippet?: string; 
    categoryHint?: string;
    published_at?: string;
    body?: string;
    extractedText?: string;
    aiSummary?: string;
  }
): Promise<ClassificationResult> {
  stats.total++;

  const cacheKey = getCacheKey(article);
  const cache = await loadCache();

  // Check cache
  const cached = cache[cacheKey];
  if (cached && cached.classifier_version === CLASSIFIER_VERSION) {
    stats.cache_hits++;
    return {
      category: cached.category,
      confidence: cached.confidence,
      rationale: cached.rationale,
      classifier_version: CLASSIFIER_VERSION,
      from_cache: true,
      from_fallback: false,
    };
  }

  stats.cache_misses++;

  // Try LLM classification
  const llmResult = await callLLMClassifier(article);
  
  // If we hit a rate limit, wait before processing next article
  if (hasHitRateLimit) {
    console.log(`[Classifier] Rate limit detected, waiting ${CLASSIFIER_COOLDOWN_MS}ms before next article`);
    await new Promise(resolve => setTimeout(resolve, CLASSIFIER_COOLDOWN_MS));
    // Reset flag so we only wait once per rate limit event
    hasHitRateLimit = false;
  }
  
  if (llmResult) {
    stats.llm_successes++;
    
    // Confidence guardrail: if confidence < threshold, use keyword fallback with categoryHint tie-breaker
    if (llmResult.confidence < CONFIDENCE_THRESHOLD) {
      console.warn(
        `[Classifier] LLM confidence ${llmResult.confidence} < ${CONFIDENCE_THRESHOLD} for "${article.title.substring(0, 50)}...", using keyword fallback`
      );
      
      const keywordCategory = classifyTopic(article);
      const keywordMatches = countKeywordMatches(article, keywordCategory);
      
      // If categoryHint exists and matches a valid category, use it as tie-breaker
      let finalCategory = keywordCategory;
      let rationale = `LLM confidence too low (${llmResult.confidence.toFixed(2)}), overridden by keyword matching (${keywordMatches} matches)`;
      
      if (article.categoryHint) {
        const hintToTopic: Record<string, Topic> = {
          'Fashion & Luxury': 'Luxury_and_Consumer',
          'Jewellery Industry': 'Jewellery_Industry',
        };
        const hintTopic = hintToTopic[article.categoryHint];
        
        if (hintTopic && keywordMatches < 2) {
          // If keyword matches are weak, prefer categoryHint
          finalCategory = hintTopic;
          rationale = `LLM confidence too low (${llmResult.confidence.toFixed(2)}), using categoryHint (${article.categoryHint}) as tie-breaker`;
        } else if (hintTopic === keywordCategory) {
          rationale += `, categoryHint (${article.categoryHint}) confirms keyword match`;
        }
      }
      
      // Use keyword result with low confidence
      return {
        category: finalCategory,
        confidence: 0.3, // Slightly higher confidence when categoryHint is used
        rationale,
        classifier_version: CLASSIFIER_VERSION,
        from_cache: false,
        from_fallback: true,
      };
    }
    
    // Save to cache
    cache[cacheKey] = {
      category: llmResult.category,
      confidence: llmResult.confidence,
      rationale: llmResult.rationale,
      classifier_version: CLASSIFIER_VERSION,
      cached_at: new Date().toISOString(),
    };
    await saveCache(cache);

    return {
      category: llmResult.category,
      confidence: llmResult.confidence,
      rationale: llmResult.rationale,
      classifier_version: CLASSIFIER_VERSION,
      from_cache: false,
      from_fallback: false,
    };
  }

  // LLM failed, fall back to rule-based classifier
  stats.llm_failures++;
  stats.fallbacks++;
  
  const fallbackCategory = classifyTopic(article);
  const keywordMatches = countKeywordMatches(article, fallbackCategory);
  
  console.warn(
    `[Classifier] LLM classification failed for "${article.title.substring(0, 50)}...", using keyword fallback: ${fallbackCategory} (${keywordMatches} matches)`
  );

  // Determine confidence based on keyword match strength
  let fallbackConfidence = 0.2; // Default low confidence
  if (keywordMatches >= 2) {
    fallbackConfidence = 0.4; // Medium confidence for strong keyword matches
  } else if (keywordMatches === 1) {
    fallbackConfidence = 0.3; // Slightly higher for single match
  }

  return {
    category: fallbackCategory,
    confidence: fallbackConfidence,
    rationale: `LLM failed, fallback to keyword-based classifier (${keywordMatches} keyword matches)`,
    classifier_version: CLASSIFIER_VERSION,
    from_cache: false,
    from_fallback: true,
  };
}

// Helper function to count keyword matches for a given category
// Uses simplified keyword lists for counting (not full classification logic)
function countKeywordMatches(
  article: { title: string; source: string },
  category: Topic
): number {
  const titleAndSource = `${article.title} ${article.source}`.toLowerCase();
  
  // Simplified keyword lists for match counting
  const categoryKeywords: Record<Topic, string[]> = {
    "Jewellery_Industry": ["jewel", "jewellery", "jewelry", "diamond", "gold", "silver", "gem", "cartier", "tiffany", "bulgari", "gemstone", "carat", "horology"],
    "Luxury_and_Consumer": ["luxury", "fashion", "affluent", "premium", "high-end", "brand", "consumer", "luxury brand", "luxury consumer"],
    "Ecommerce_Retail_Tech": ["ecommerce", "e-commerce", "retail", "shopify", "online store", "checkout", "fulfillment", "retail tech", "retail technology", "omnichannel"],
    "AI_and_Strategy": ["ai", "artificial intelligence", "llm", "gpt", "openai", "benchmark", "model release", "mmlu", "anthropic", "claude", "machine learning"],
  };
  
  const keywords = categoryKeywords[category] || [];
  let matches = 0;
  for (const kw of keywords) {
    // Use word boundary for short keywords, substring for longer ones
    if (kw.length <= 3) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(titleAndSource)) {
        matches++;
      }
    } else {
      if (titleAndSource.includes(kw.toLowerCase())) {
        matches++;
      }
    }
  }
  return matches;
}

