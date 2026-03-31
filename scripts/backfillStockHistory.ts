/**
 * Backfill stock history — fetch ~4 years of weekly price data + FX rates
 * without running the full weekly pipeline (no OpenAI required).
 *
 * Usage: npx tsx scripts/backfillStockHistory.ts
 *
 * Writes:
 *  - data/stock-history.json      native-currency weekly candles, growing store
 *  - data/competitor-intel.json   priceHistory (USD) + change1w patched
 */

import { promises as fs } from 'fs';
import path from 'path';
import { DateTime } from 'luxon';
import { loadEnv } from '../lib/env';
import { loadStockHistory, mergeStockHistory, saveStockHistory, toWeekStart } from '../lib/utils/stockHistory';
import type { StockCandle } from '../lib/utils/stockHistory';

loadEnv();

const INTEL_PATH = path.join(process.cwd(), 'data', 'competitor-intel.json');
const WEEKS_BACK = 210; // ~4 years

const PUBLIC_TICKERS: { ticker: string; parentName: string }[] = [
  { ticker: 'SIG',       parentName: 'Signet Jewelers' },
  { ticker: 'CFR.SW',    parentName: 'Richemont' },
  { ticker: 'MC.PA',     parentName: 'LVMH' },
  { ticker: 'PNDORA.CO', parentName: 'Pandora A/S' },
];

const FX_SYMBOLS: Record<string, string> = {
  EUR: 'EURUSD=X',
  CHF: 'CHFUSD=X',
  DKK: 'DKKUSD=X',
  GBP: 'GBPUSD=X',
};

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import('yahoo-finance2') as any;
  const YF = mod.YahooFinance ?? mod.default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yf: any = typeof YF === 'function' ? new YF() : YF;

  const period1 = DateTime.now().minus({ weeks: WEEKS_BACK }).toJSDate();
  const period2 = new Date();

  // ── 1. Fetch native-currency weekly candles ──
  const newCandlesMap = new Map<string, StockCandle[]>();
  const currencyMap = new Map<string, string>(); // ticker → currency

  for (const { ticker, parentName } of PUBLIC_TICKERS) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quote = await (yf.quote as (s: string) => Promise<any>)(ticker);
      const currency: string = quote.currency ?? 'USD';
      currencyMap.set(ticker, currency);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chart = await (yf.chart as (s: string, o: any) => Promise<any>)(ticker, {
        period1,
        period2,
        interval: '1wk',
      });

      const candles: StockCandle[] = (
        (chart?.quotes ?? []) as { date?: Date | string; close?: number | null }[]
      )
        .filter(q => q.close != null)
        .map(q => ({
          // Normalize to Monday YYYY-MM-DD so US + European candles align
          date: toWeekStart(q.date instanceof Date ? q.date.toISOString() : String(q.date)),
          close: q.close as number,
        }))
        .slice(0, -1); // drop partial current-week candle

      newCandlesMap.set(ticker, candles);
      console.log(`✓ ${ticker} (${parentName}): ${candles.length} candles [${candles[0]?.date} → ${candles[candles.length - 1]?.date}], ${currency}`);
    } catch (err) {
      console.warn(`✗ ${ticker}: fetch failed —`, err);
    }
  }

  // ── 2. Merge into persistent stock history (native currency) ──
  const existing = await loadStockHistory();
  const merged = mergeStockHistory(existing, newCandlesMap);
  await saveStockHistory(merged);
  console.log('\n✓ data/stock-history.json updated');

  // ── 3. Fetch FX rates (same window, same normalization) ──
  const neededCurrencies = new Set(
    Array.from(currencyMap.values()).filter(c => c !== 'USD')
  );
  const fxRates = new Map<string, Map<string, number>>(); // currency → date→rate

  for (const currency of neededCurrencies) {
    const sym = FX_SYMBOLS[currency];
    if (!sym) { console.warn(`No FX symbol for ${currency}`); continue; }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chart = await (yf.chart as (s: string, o: any) => Promise<any>)(sym, {
        period1,
        period2,
        interval: '1wk',
      });
      const rateByDate = new Map<string, number>();
      for (const q of (chart?.quotes ?? []) as { date?: Date | string; close?: number | null }[]) {
        if (q.close == null) continue;
        const key = toWeekStart(q.date instanceof Date ? q.date.toISOString() : String(q.date));
        rateByDate.set(key, q.close);
      }
      fxRates.set(currency, rateByDate);
      console.log(`✓ FX ${sym}: ${rateByDate.size} candles`);
    } catch (err) {
      console.warn(`✗ FX ${sym}: fetch failed —`, err);
    }
  }

  function getRate(currency: string, dateStr: string): number {
    if (currency === 'USD') return 1;
    const map = fxRates.get(currency);
    if (!map?.size) return 1;
    const key = dateStr.slice(0, 10);
    if (map.has(key)) return map.get(key)!;
    // Nearest prior date fallback
    const keys = Array.from(map.keys()).sort();
    let nearest = keys[0];
    for (const k of keys) { if (k <= key) nearest = k; else break; }
    return map.get(nearest) ?? 1;
  }

  // ── 4. Patch competitor-intel.json ──
  let intel: Record<string, unknown> = {};
  try {
    intel = JSON.parse(await fs.readFile(INTEL_PATH, 'utf-8'));
  } catch {
    console.warn('competitor-intel.json not found — skipping patch');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brands = intel.brands as Record<string, any>;
  let patched = 0;

  for (const [, brandIntel] of Object.entries(brands)) {
    const fin = brandIntel?.financials;
    if (!fin?.ticker) continue;

    const ticker: string = fin.ticker;
    const currency: string = currencyMap.get(ticker) ?? fin.currency ?? 'USD';
    const history = merged[ticker];
    if (!history?.length) continue;

    // USD-converted priceHistory
    fin.priceHistory = history.map((c: StockCandle) => ({
      date: c.date,
      close: Math.round(c.close * getRate(currency, c.date) * 100) / 100,
    }));

    // Recompute change1w from last two completed native candles
    // (merged history excludes the partial current-week candle)
    const n = history.length;
    if (n >= 2) {
      const prev = history[n - 2].close;
      const latest = history[n - 1].close;
      if (prev > 0) {
        fin.change1w = Math.round(((latest - prev) / prev) * 10000) / 100;
      }
    }

    patched++;
    console.log(`  patched ${ticker}: change1w=${fin.change1w}%, ${fin.priceHistory.length} candles`);
  }

  await fs.writeFile(INTEL_PATH, JSON.stringify(intel, null, 2), 'utf-8');
  console.log(`\n✓ data/competitor-intel.json — ${patched} brands patched`);
  console.log('Done. Restart the dev server to pick up the new data.');
}

main().catch(err => { console.error(err); process.exit(1); });
