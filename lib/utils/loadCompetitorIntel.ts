import { promises as fs } from 'fs';
import path from 'path';
import type { CompetitorId } from '@/lib/constants/competitorBrands';

export type FinancialData = {
  ticker: string;
  parentName: string;
  price: number;
  currency: string;
  change1w: number; // % change over last 5 trading days
  fetchedAt: string;
  priceHistory?: { date: string; close: number }[];
};

export type BrandIntel = {
  narrative: string; // 2-3 sentence strategic summary
  financials: FinancialData | null; // null for private brands
};

export type CompetitorIntel = {
  generatedAt: string | null;
  weekLabel: string | null;
  briefing: string[]; // 3-5 bullet strings
  brands: Partial<Record<CompetitorId, BrandIntel>>;
};

const EMPTY: CompetitorIntel = {
  generatedAt: null,
  weekLabel: null,
  briefing: [],
  brands: {},
};

export async function loadCompetitorIntel(): Promise<CompetitorIntel> {
  const intelPath = path.join(process.cwd(), 'data', 'competitor-intel.json');
  try {
    const raw = await fs.readFile(intelPath, 'utf-8');
    return JSON.parse(raw) as CompetitorIntel;
  } catch {
    return EMPTY;
  }
}
