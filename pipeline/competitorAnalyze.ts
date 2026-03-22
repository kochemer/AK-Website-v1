/**
 * Competitor Intelligence Analyzer
 *
 * Pipeline step that runs after classification/digest build:
 *  1. Signal-tags each competitor article (Launch, Campaign, etc.)
 *  2. Generates per-brand strategic narrative via OpenAI
 *  3. Generates weekly briefing (3-5 bullets) from all narratives
 *  4. Fetches live financial data for public companies (yahoo-finance2)
 *  5. Writes output to data/competitor-intel.json
 *
 * Safe to re-run: existing articles.json signal tags are preserved on
 * articles that didn't change; only untagged competitor articles are sent
 * to OpenAI.
 */

import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { DateTime } from 'luxon';
import { loadEnv } from '../lib/env';
import { COMPETITOR_BRANDS, type CompetitorId } from '../lib/constants/competitorBrands';
import { matchCompetitors } from '../lib/utils/competitorMatcher';
import { getModelFor, maxTokensParam, temperatureParam } from '../lib/llm/models';
import type { Article, SignalTag } from '../lib/types/article';
import type { CompetitorIntel, BrandIntel, FinancialData } from '../lib/utils/loadCompetitorIntel';

// ── Constants ──────────────────────────────────────────────────────────────

const ARTICLES_PATH = path.join(process.cwd(), 'data', 'articles.json');
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'competitor-intel.json');
const LOOKBACK_WEEKS = 12;
const NARRATIVE_ARTICLE_LIMIT = 15; // articles fed into brand narrative prompt
const SIGNAL_BATCH_SIZE = 20; // articles per OpenAI call for signal tagging

const SIGNAL_TAGS: SignalTag[] = [
  'Launch', 'Campaign', 'Partnership', 'Financials',
  'Controversy', 'Leadership', 'Expansion',
];

// Tickers to fetch (deduplicated — Cartier/Van Cleef share CFR.SW, Tiffany/Bulgari share MC.PA)
const PUBLIC_TICKERS: { ticker: string; parentName: string }[] = [
  { ticker: 'SIG', parentName: 'Signet Jewelers' },
  { ticker: 'CFR.SW', parentName: 'Richemont' },
  { ticker: 'MC.PA', parentName: 'LVMH' },
  { ticker: 'PNDORA.CO', parentName: 'Pandora A/S' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function articleText(a: Article): string {
  return [a.title, a.snippet, a.aiSummary, a.summary]
    .filter(Boolean)
    .join(' | ')
    .slice(0, 400);
}

function getCutoff(): string {
  return DateTime.now().minus({ weeks: LOOKBACK_WEEKS }).toISO()!;
}

// ── Signal tagging ─────────────────────────────────────────────────────────

async function tagSignals(
  articles: Article[],
  openai: OpenAI
): Promise<Map<string, SignalTag>> {
  const model = getModelFor('classify');
  const result = new Map<string, SignalTag>();

  // Only tag articles that don't already have a signalTag
  const untagged = articles.filter(a => !a.signalTag);
  if (untagged.length === 0) return result;

  console.log(`  [signals] Tagging ${untagged.length} articles (${SIGNAL_BATCH_SIZE}/batch)...`);

  for (let i = 0; i < untagged.length; i += SIGNAL_BATCH_SIZE) {
    const batch = untagged.slice(i, i + SIGNAL_BATCH_SIZE);
    const lines = batch
      .map((a, idx) => `${idx + 1}. ${articleText(a)}`)
      .join('\n');

    const prompt = `Classify each article into exactly ONE of these signal types:\n${SIGNAL_TAGS.join(', ')}\n\nDefinitions:\n- Launch: new product, collection, or service released\n- Campaign: marketing, advertising, or brand campaign\n- Partnership: collaboration, joint venture, or licensing deal\n- Financials: earnings, revenue, stock news, funding, M&A\n- Controversy: negative press, backlash, legal issues, ethics\n- Leadership: exec change, appointment, departure\n- Expansion: new market, new store, geographic growth\n\nArticles:\n${lines}\n\nRespond with ONLY a JSON array of ${batch.length} signal strings in order, e.g. ["Launch","Financials",...]`;

    try {
      const resp = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        ...maxTokensParam(model, 200),
        ...temperatureParam(model, 0),
      });
      const raw = resp.choices[0]?.message?.content?.trim() ?? '[]';
      const tags = JSON.parse(raw) as string[];
      batch.forEach((a, idx) => {
        const tag = tags[idx];
        if (SIGNAL_TAGS.includes(tag as SignalTag)) {
          result.set(a.url, tag as SignalTag);
        }
      });
    } catch (err) {
      console.warn(`  [signals] Batch ${Math.floor(i / SIGNAL_BATCH_SIZE) + 1} failed:`, err);
    }
  }

  return result;
}

// ── Brand narratives ───────────────────────────────────────────────────────

async function generateNarrative(
  brandName: string,
  articles: Article[],
  openai: OpenAI
): Promise<string> {
  const model = getModelFor('summarize');
  const recentArticles = articles
    .slice(0, NARRATIVE_ARTICLE_LIMIT)
    .map(a => `- ${a.title}: ${a.aiSummary || a.snippet || ''}`)
    .join('\n');

  const prompt = `Based on recent news coverage, write a 2-3 sentence strategic narrative for ${brandName}.\nFocus on: What story is this brand telling right now? Key themes, moves, or positioning.\nBe specific and analytical. No marketing language.\n\nRecent articles:\n${recentArticles}\n\nStrategic narrative:`;

  try {
    const resp = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      ...maxTokensParam(model, 200),
      ...temperatureParam(model, 0.3),
    });
    return resp.choices[0]?.message?.content?.trim() ?? '';
  } catch {
    return '';
  }
}

// ── Weekly briefing ────────────────────────────────────────────────────────

async function generateBriefing(
  narratives: Record<string, string>,
  openai: OpenAI
): Promise<string[]> {
  const model = getModelFor('summarize');
  const narrativeBlock = Object.entries(narratives)
    .filter(([, n]) => n)
    .map(([brand, narrative]) => `${brand}: ${narrative}`)
    .join('\n\n');

  if (!narrativeBlock) return [];

  const prompt = `You are a luxury industry analyst. Based on these competitor brand narratives, write a 3-5 bullet weekly intelligence briefing for Pandora leadership.\nEach bullet should be 1 sentence. Focus on cross-brand patterns, market shifts, or standout moves.\n\nBrand narratives:\n${narrativeBlock}\n\nWeekly briefing bullets (return as JSON array of strings):`;

  try {
    const resp = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      ...maxTokensParam(model, 400),
      ...temperatureParam(model, 0.3),
    });
    const raw = (resp.choices[0]?.message?.content?.trim() ?? '[]')
      .replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const bullets = JSON.parse(raw) as string[];
    return Array.isArray(bullets) ? bullets.slice(0, 5) : [];
  } catch {
    return [];
  }
}

// ── Financial data ─────────────────────────────────────────────────────────

async function fetchFinancials(): Promise<Map<string, FinancialData>> {
  const result = new Map<string, FinancialData>();
  // yahoo-finance2 v3 requires instantiation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let yahooFinance: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('yahoo-finance2') as any;
    const YF = mod.YahooFinance ?? mod.default;
    yahooFinance = typeof YF === 'function' ? new YF() : YF;
  } catch {
    console.warn('  [financials] yahoo-finance2 not available, skipping');
    return result;
  }

  for (const { ticker, parentName } of PUBLIC_TICKERS) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quote = await (yahooFinance.quote as (symbol: string) => Promise<any>)(ticker);
      let chartResult = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chartResult = await (yahooFinance.chart as (symbol: string, opts: any) => Promise<any>)(ticker, {
          period1: DateTime.now().minus({ days: 7 }).toJSDate(),
          period2: new Date(),
          interval: '1d',
        });
      } catch {
        // chart data unavailable — fall back to today's change
      }

      const price = quote.regularMarketPrice ?? 0;
      const currency = quote.currency ?? 'USD';

      // Calculate 1-week % change from chart data or fallback to 52w low/high
      let change1w = 0;
      if (chartResult?.quotes && chartResult.quotes.length >= 2) {
        const oldest = chartResult.quotes[0]?.close;
        const newest = chartResult.quotes[chartResult.quotes.length - 1]?.close;
        if (oldest && newest && oldest > 0) {
          change1w = ((newest - oldest) / oldest) * 100;
        }
      } else if (quote.regularMarketChangePercent != null) {
        // Fallback: use today's change
        change1w = quote.regularMarketChangePercent;
      }

      result.set(ticker, {
        ticker,
        parentName,
        price: Math.round(price * 100) / 100,
        currency,
        change1w: Math.round(change1w * 100) / 100,
        fetchedAt: new Date().toISOString(),
      });

      console.log(`  [financials] ${ticker} (${parentName}): ${currency} ${price.toFixed(2)} (${change1w >= 0 ? '+' : ''}${change1w.toFixed(2)}%)`);
    } catch (err) {
      console.warn(`  [financials] Failed to fetch ${ticker}:`, err);
    }
  }

  return result;
}

// ── Main export ────────────────────────────────────────────────────────────

export async function runCompetitorAnalyze(weekLabel: string): Promise<void> {
  loadEnv();
  console.log(`[CompetitorAnalyze] Starting for week ${weekLabel}...`);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // 1. Load articles.json
  let allArticles: Article[] = [];
  try {
    const raw = await fs.readFile(ARTICLES_PATH, 'utf-8');
    allArticles = JSON.parse(raw) as Article[];
  } catch {
    console.warn('[CompetitorAnalyze] Could not read articles.json, aborting');
    return;
  }

  // 2. Filter to last LOOKBACK_WEEKS weeks
  const cutoff = getCutoff();
  const recent = allArticles.filter(a => {
    const date = a.published_at || a.discoveredAt || a.ingested_at;
    return !!date && date >= cutoff;
  });

  // 3. Match competitor articles and bucket them
  const brandBuckets = new Map<CompetitorId, Article[]>();
  for (const brand of COMPETITOR_BRANDS) {
    brandBuckets.set(brand.id, []);
  }
  const competitorArticles: Article[] = [];
  for (const article of recent) {
    const matches = matchCompetitors(article);
    if (matches.length > 0) {
      competitorArticles.push(article);
      for (const brandId of matches) {
        brandBuckets.get(brandId)!.push(article);
      }
    }
  }
  console.log(`[CompetitorAnalyze] Found ${competitorArticles.length} competitor articles in last ${LOOKBACK_WEEKS} weeks`);

  // 4. Signal tagging (deduped articles only)
  const uniqueCompetitorArticles = Array.from(
    new Map(competitorArticles.map(a => [a.url, a])).values()
  );
  const signalMap = await tagSignals(uniqueCompetitorArticles, openai);
  console.log(`[CompetitorAnalyze] Tagged ${signalMap.size} articles with signal types`);

  // 5. Write signal tags back to articles.json
  let updatedCount = 0;
  const articleIndex = new Map(allArticles.map(a => [a.url, a]));
  for (const [url, tag] of signalMap) {
    const article = articleIndex.get(url);
    if (article && article.signalTag !== tag) {
      article.signalTag = tag;
      updatedCount++;
    }
  }
  if (updatedCount > 0) {
    await fs.writeFile(ARTICLES_PATH, JSON.stringify(allArticles, null, 2), 'utf-8');
    console.log(`[CompetitorAnalyze] Updated ${updatedCount} articles with signal tags in articles.json`);
  }

  // 6. Apply signal tags to bucketed articles (in-memory for narratives)
  for (const articles of brandBuckets.values()) {
    for (const article of articles) {
      if (signalMap.has(article.url)) {
        article.signalTag = signalMap.get(article.url);
      }
    }
  }

  // 7. Generate per-brand narratives
  console.log(`[CompetitorAnalyze] Generating brand narratives...`);
  const narratives: Record<string, string> = {};
  const brandIntels: Partial<Record<CompetitorId, BrandIntel>> = {};

  for (const brand of COMPETITOR_BRANDS) {
    const articles = brandBuckets.get(brand.id) ?? [];
    if (articles.length === 0) {
      brandIntels[brand.id] = { narrative: '', financials: null };
      continue;
    }

    const narrative = await generateNarrative(brand.name, articles, openai);
    narratives[brand.name] = narrative;
    brandIntels[brand.id] = { narrative, financials: null };
    console.log(`  [narrative] ${brand.name}: ${narrative.slice(0, 80)}...`);
  }

  // 8. Generate weekly briefing
  console.log(`[CompetitorAnalyze] Generating weekly briefing...`);
  const briefing = await generateBriefing(narratives, openai);
  console.log(`[CompetitorAnalyze] Briefing: ${briefing.length} bullets`);

  // 9. Fetch financials
  console.log(`[CompetitorAnalyze] Fetching financial data...`);
  const financialMap = await fetchFinancials();

  // 10. Attach financials to brands
  for (const brand of COMPETITOR_BRANDS) {
    if ('ticker' in brand && brand.ticker) {
      const fin = financialMap.get(brand.ticker);
      if (fin && brandIntels[brand.id]) {
        brandIntels[brand.id]!.financials = fin;
      }
    }
  }

  // 11. Write competitor-intel.json
  const output: CompetitorIntel = {
    generatedAt: new Date().toISOString(),
    weekLabel,
    briefing,
    brands: brandIntels,
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`[CompetitorAnalyze] ✓ Written to data/competitor-intel.json`);
}
