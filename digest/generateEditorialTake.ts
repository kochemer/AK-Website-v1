/**
 * Generate the weekly Editor's Take — a first-person, opinionated editorial
 * commentary for the weekly digest. Designed to feel human and analytical,
 * not like an automated summary.
 *
 * Supports an override flag: if editorialTakeOverride is set in the digest JSON,
 * the pipeline will NOT overwrite the editorialTake field on rebuild. This lets
 * the editor manually tweak the text after generation without losing it.
 *
 * To regenerate a manually overridden take: pass regenTake=true, or delete
 * editorialTakeOverride from the digest JSON before rebuilding.
 */

import crypto from 'crypto';
import OpenAI from 'openai';
import type { WeeklyDigest } from './buildWeeklyDigest';
import { getTopicDisplayName } from '../lib/utils/topicNames';
import { readJsonCache, writeJsonCache } from '../lib/utils/cachePaths';
import { getModelFor, maxTokensParam, temperatureParam } from '../lib/llm/models';

// ── Configuration ─────────────────────────────────────────────────────────────
const TAKE_MODEL = process.env.EDITORIAL_TAKE_MODEL || getModelFor('summarize');
const TEMPERATURE = 0.4; // Slightly higher than summaries — we want voice, not determinism
const MAX_TOKENS = 400;
const CACHE_KIND = 'editorial-take';
const TAKE_VERSION = '1.1';

// ── Types ─────────────────────────────────────────────────────────────────────
type TakeResult = {
  editorialTake: string;
};

type CacheEntry = {
  editorialTake: string;
  cached_at: string;
  model: string;
  version: string;
};

type TakeCache = {
  [key: string]: CacheEntry;
};

// ── Cache helpers ─────────────────────────────────────────────────────────────
async function loadCache(): Promise<TakeCache> {
  return (await readJsonCache<TakeCache>(CACHE_KIND)) || {};
}

async function saveCache(cache: TakeCache): Promise<void> {
  try {
    await writeJsonCache(CACHE_KIND, cache);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[EditorialTake] Failed to save cache: ${msg}`);
  }
}

function fingerprintDigest(digest: WeeklyDigest): string {
  const urls: string[] = [];
  for (const key of ['AI_and_Strategy', 'Ecommerce_Retail_Tech', 'Luxury_and_Consumer', 'Jewellery_Industry'] as const) {
    for (const article of digest.topics[key]?.top ?? []) {
      if (article.url) urls.push(article.url);
    }
  }
  return crypto.createHash('md5').update(JSON.stringify(urls.sort())).digest('hex').slice(0, 12);
}

function getCacheKey(weekLabel: string, digest: WeeklyDigest): string {
  return `${weekLabel}:${fingerprintDigest(digest)}`;
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildEditorialTakePrompt(digest: WeeklyDigest): string {
  const topicKeys = ['AI_and_Strategy', 'Ecommerce_Retail_Tech', 'Luxury_and_Consumer', 'Jewellery_Industry'] as const;

  const articleLines: string[] = [];
  for (const key of topicKeys) {
    const topic = digest.topics[key];
    if (!topic?.top?.length) continue;
    const topicName = getTopicDisplayName(key);
    articleLines.push(`\n[${topicName}]`);
    for (const article of topic.top.slice(0, 4)) {
      const summary = article.aiSummary || article.snippet || '';
      articleLines.push(`- ${article.title}${summary ? `: ${summary.slice(0, 120)}` : ''}`);
    }
  }

  const weeklyInsight = digest.weeklyInsight || digest.oneSentenceSummary || '';

  return `You are Alexey Kochemirovskiy — ex-management consultant, former physics researcher, ecommerce strategist based in Copenhagen. You curate a weekly intelligence digest covering AI, ecommerce, luxury, and jewellery.

Write your Editor's Spotlight for this week. This is a short, opinionated column — punchy, specific, and personal. Think of it as the sharpest thing you'd say to a smart colleague who just asked "what actually mattered this week and why?"

THIS WEEK'S ARTICLES:
${articleLines.join('\n')}

${weeklyInsight ? `THIS WEEK'S INSIGHT (from our analysis): ${weeklyInsight}` : ''}

CONTENT RULES:
1. Pick ONE concrete signal — a specific company move, number, or tension — that has real strategic implications. Not a vague theme.
2. Name the companies, cite the numbers, reference the actual events from the articles above.
3. State a clear, specific opinion. Not "this is worth watching" — but what you actually think it means and why it matters.
4. End with one sharp forward-looking question or unresolved tension. Not rhetorical — something genuinely hard to answer.

FORMAT:
- 2 short paragraphs. Each paragraph 3-5 sentences. Total 100-150 words.
- Separate the paragraphs with a blank line (\\n\\n).
- No headers. No bullet points. No numbered lists.

WRITING STYLE:
- Short sentences. Vary rhythm. No padding.
- Reads like a smart human wrote it at 8am, not like a press release or a blog post.
- Direct and specific. Never hedging with "may", "could", "might suggest".

STRICT BANS (any violation makes this unusable):
- NEVER mention Pandora or any employer
- NO "this week" as an opener
- NO em-dashes (use commas or colons instead)
- NO: "groundbreaking", "transformative", "revolutionary", "significant", "exciting", "fascinating", "notable", "interesting", "landscape", "ecosystem", "it remains to be seen"
- NO meta-references to "this digest", "the articles", "the stories above"
- NO filler openers like "What I find...", "There's something...", "It's worth noting..."
- DO write in first person: "I", "my", "what I think..."

Format your response as JSON:
{
  "editorialTake": "Paragraph one here.\\n\\nParagraph two here."
}`;
}

// ── LLM call ──────────────────────────────────────────────────────────────────
async function callLLMForEditorialTake(digest: WeeklyDigest): Promise<TakeResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[EditorialTake] OPENAI_API_KEY not set, skipping');
    return null;
  }

  try {
    const openai = new OpenAI({ apiKey });
    const prompt = buildEditorialTakePrompt(digest);

    const response = await openai.chat.completions.create({
      model: TAKE_MODEL,
      ...temperatureParam(TAKE_MODEL, TEMPERATURE),
      ...maxTokensParam(TAKE_MODEL, MAX_TOKENS),
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content);
    const editorialTake = typeof parsed.editorialTake === 'string' ? parsed.editorialTake.trim() : '';
    if (!editorialTake || editorialTake.length < 50) {
      console.warn('[EditorialTake] Response too short, discarding');
      return null;
    }

    return { editorialTake };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[EditorialTake] LLM call failed: ${msg}`);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Generate the Editor's Take for a weekly digest with caching.
 *
 * Will skip generation and return null if:
 *   - digest.editorialTakeOverride is true (manual edit protection)
 *   - OPENAI_API_KEY is not set
 *
 * Pass regenTake=true to bypass cache (but still respects the override flag).
 */
export async function generateEditorialTakeForDigest(
  digest: WeeklyDigest,
  regenTake = false,
): Promise<TakeResult | null> {
  // Respect manual override flag — never clobber editor's own text
  if (digest.editorialTakeOverride) {
    console.log(`[EditorialTake] Override flag set for ${digest.weekLabel}, skipping generation`);
    return null;
  }

  const cache = await loadCache();
  const cacheKey = getCacheKey(digest.weekLabel, digest);

  if (!regenTake) {
    const cached = cache[cacheKey];
    if (cached && cached.version === TAKE_VERSION && cached.model === TAKE_MODEL) {
      console.log(`[EditorialTake] Cache hit for ${digest.weekLabel}`);
      return { editorialTake: cached.editorialTake };
    }
  }

  console.log(`[EditorialTake] Generating editorial take for ${digest.weekLabel}...`);
  const result = await callLLMForEditorialTake(digest);

  if (!result) {
    console.warn(`[EditorialTake] Generation failed for ${digest.weekLabel}`);
    return null;
  }

  cache[cacheKey] = {
    editorialTake: result.editorialTake,
    cached_at: new Date().toISOString(),
    model: TAKE_MODEL,
    version: TAKE_VERSION,
  };
  await saveCache(cache);

  console.log(`[EditorialTake] ✓ Generated for ${digest.weekLabel}`);
  return result;
}
