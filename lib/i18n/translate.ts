/**
 * Article translation utility for digest localization.
 *
 * Uses OpenAI to translate article titles + summaries into DA/ES.
 * Implements hash-based caching to avoid re-translating unchanged content.
 *
 * Cache location: data/cache/article-translations.json
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import type { ArticleTranslations } from './types';

const AI_MODEL = 'gpt-4o-mini';
const MAX_OUTPUT_TOKENS = 400;
const TEMPERATURE = 0.3;

const CACHE_PATH = path.join(process.cwd(), 'data', 'cache', 'article-translations.json');

type CacheEntry = {
  da: { title: string; summary: string };
  es: { title: string; summary: string };
  translatedAt: string;
};

type TranslationCache = Record<string, CacheEntry>;

/**
 * Compute a stable hash for an article's translatable content.
 */
function contentHash(title: string, summary: string): string {
  return createHash('sha256')
    .update(`${title}||${summary}`)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Load translation cache from disk.
 */
async function loadCache(): Promise<TranslationCache> {
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf-8');
    return JSON.parse(raw) as TranslationCache;
  } catch {
    return {};
  }
}

/**
 * Save translation cache to disk.
 */
async function saveCache(cache: TranslationCache): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

type TranslationResult = {
  da: { title: string; summary: string };
  es: { title: string; summary: string };
};

/**
 * Translate a single article's title + summary into DA and ES using OpenAI.
 */
async function translateSingle(
  title: string,
  summary: string
): Promise<TranslationResult | null> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.error('[Translate] OPENAI_API_KEY not set — skipping translation');
    return null;
  }

  const prompt = `Translate the following article title and summary into Danish (da) and Spanish (es).
Return ONLY valid JSON with this exact structure (no markdown, no backticks):
{
  "da": { "title": "...", "summary": "..." },
  "es": { "title": "...", "summary": "..." }
}

Title: "${title}"
Summary: "${summary || '(no summary available)'}"

Rules:
- Keep brand names, product names, and proper nouns untranslated.
- Keep the translation concise and natural.
- If summary is "(no summary available)", set summary to an empty string "".
- Do NOT add any explanation, just the JSON.`;

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const res = await openai.chat.completions.create({
      model: AI_MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = res.choices[0]?.message?.content?.trim();
    if (!raw) return null;

    // Strip markdown fences if present
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(jsonStr) as TranslationResult;

    // Basic validation
    if (!parsed.da?.title || !parsed.es?.title) {
      console.warn('[Translate] Invalid translation structure — missing title fields');
      return null;
    }

    return parsed;
  } catch (e: any) {
    console.error(`[Translate] Error translating "${title.substring(0, 50)}...":`, e?.message);
    return null;
  }
}

type ArticleToTranslate = {
  title: string;
  aiSummary?: string | null;
};

type TranslateDigestStats = {
  total: number;
  cached: number;
  translated: number;
  failed: number;
};

/**
 * Translate all top articles in a digest into DA and ES.
 * Uses hash-based cache to skip unchanged content.
 * Returns the translations map keyed by article title (for attachment to articles).
 */
export async function translateDigestArticles(
  articles: ArticleToTranslate[]
): Promise<{ translations: Map<string, ArticleTranslations>; stats: TranslateDigestStats }> {
  const cache = await loadCache();
  const translations = new Map<string, ArticleTranslations>();
  const stats: TranslateDigestStats = { total: articles.length, cached: 0, translated: 0, failed: 0 };

  // Batch: identify which need translation
  const toTranslate: Array<{ article: ArticleToTranslate; hash: string }> = [];

  for (const article of articles) {
    const summary = article.aiSummary || '';
    const hash = contentHash(article.title, summary);

    if (cache[hash]) {
      // Cache hit — reuse
      translations.set(article.title, {
        da: cache[hash].da,
        es: cache[hash].es,
      });
      stats.cached++;
    } else {
      toTranslate.push({ article, hash });
    }
  }

  // Translate uncached articles (with concurrency limit)
  const BATCH_SIZE = 5;
  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    const batch = toTranslate.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async ({ article, hash }) => {
        const result = await translateSingle(article.title, article.aiSummary || '');
        return { article, hash, result };
      })
    );

    for (const { article, hash, result } of results) {
      if (result) {
        cache[hash] = {
          da: result.da,
          es: result.es,
          translatedAt: new Date().toISOString(),
        };
        translations.set(article.title, {
          da: result.da,
          es: result.es,
        });
        stats.translated++;
      } else {
        stats.failed++;
      }
    }
  }

  // Persist cache
  if (stats.translated > 0) {
    await saveCache(cache);
  }

  return { translations, stats };
}
