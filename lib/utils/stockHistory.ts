import { promises as fs } from 'fs';
import path from 'path';

const STOCK_HISTORY_PATH = path.join(process.cwd(), 'data', 'stock-history.json');

export type StockCandle = { date: string; close: number };
export type StockHistoryStore = Record<string, StockCandle[]>;

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
