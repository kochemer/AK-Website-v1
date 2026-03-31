import { promises as fs } from 'fs';
import path from 'path';

const STOCK_HISTORY_PATH = path.join(process.cwd(), 'data', 'stock-history.json');

export type StockCandle = { date: string; close: number };
export type StockHistoryStore = Record<string, StockCandle[]>;

/**
 * Snap any date string to the Monday of its ISO week (YYYY-MM-DD).
 * Handles the common case where European exchanges report Sunday 23:00 UTC
 * for what is effectively Monday 00:00 local time — we advance Sunday → Monday.
 * US exchanges report Monday already; all other days go back to previous Monday.
 */
export function toWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  if (day === 0) {
    // Sunday midnight CET = Monday open → advance to Monday
    d.setUTCDate(d.getUTCDate() + 1);
  } else if (day !== 1) {
    // Any other non-Monday → back to previous Monday
    d.setUTCDate(d.getUTCDate() - (day - 1));
  }
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function loadStockHistory(): Promise<StockHistoryStore> {
  try {
    const raw = await fs.readFile(STOCK_HISTORY_PATH, 'utf-8');
    return JSON.parse(raw) as StockHistoryStore;
  } catch {
    return {};
  }
}

export function mergeStockHistory(
  existing: StockHistoryStore,
  newCandles: Map<string, StockCandle[]>
): StockHistoryStore {
  const merged: StockHistoryStore = { ...existing };

  for (const [ticker, candles] of newCandles) {
    const existing_candles = merged[ticker] ?? [];
    // Build a map keyed by YYYY-MM-DD prefix for deduplication
    const byDate = new Map<string, StockCandle>();
    for (const c of existing_candles) {
      byDate.set(c.date.slice(0, 10), c);
    }
    for (const c of candles) {
      byDate.set(c.date.slice(0, 10), c);
    }
    // Sort ascending by date
    merged[ticker] = Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }

  return merged;
}

export async function saveStockHistory(store: StockHistoryStore): Promise<void> {
  await fs.writeFile(STOCK_HISTORY_PATH, JSON.stringify(store, null, 2), 'utf-8');
}
