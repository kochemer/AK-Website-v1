/**
 * Module function for weekly discovery
 * Extracted from scripts/discoverWeekly.ts for use by orchestrator
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import { getWeekRangeCET } from '../lib/utils/weekCET';
import { generateSearchQueries } from './queryDirector';
import { searchWithTavily } from './searchProvider';
import { fetchAndExtractArticles } from './fetchExtract';
import { selectTopArticles } from './selectTop';
import { mergeDiscoveryArticles } from './mergeArticles';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse weekLabel to get week start/end dates in CET
 */
function getWeekDates(weekLabel: string): { weekStart: Date; weekEnd: Date } {
  const weekMatch = weekLabel.match(/^(\d{4})-W(\d{1,2})$/);
  if (!weekMatch) {
    throw new Error(`Invalid weekLabel: ${weekLabel}`);
  }
  const year = parseInt(weekMatch[1], 10);
  const weekNumber = parseInt(weekMatch[2], 10);
  
  const dt = DateTime.fromObject({ weekYear: year, weekNumber }, { zone: 'Europe/Copenhagen' });
  if (!dt.isValid) {
    throw new Error(`Invalid week: ${weekLabel}`);
  }
  
  const { weekStartCET, weekEndCET } = getWeekRangeCET(dt.toJSDate());
  return { weekStart: weekStartCET, weekEnd: weekEndCET };
}

export type DiscoverWeeklyOptions = {
  weekLabel: string;
  maxCandidates?: number;
  selectTop?: number;
  regenDelta?: boolean;
  noDelta?: boolean;
};

export async function discoverWeekly(options: DiscoverWeeklyOptions): Promise<{ added: number; updated: number }> {
  const {
    weekLabel,
    maxCandidates = 240,
    selectTop = 20,
    regenDelta = false,
    noDelta = false,
  } = options;

  const weekDir = path.join(process.cwd(), 'data', 'weeks', weekLabel);
  const discoveryDir = path.join(weekDir, 'discovery');

  // Step 1: Generate search queries
  const queries = await generateSearchQueries(weekLabel, discoveryDir, {
    regenDelta,
    noDelta,
  });

  // Step 2: Search (with time-bound)
  const { weekStart, weekEnd } = getWeekDates(weekLabel);
  const { results: searchResults } = await searchWithTavily(
    queries,
    maxCandidates,
    discoveryDir,
    { weekStart, weekEnd, weekLabel }
  );

  // Step 3: Fetch and extract
  const { articles: extracted } = await fetchAndExtractArticles(
    searchResults,
    discoveryDir,
    { weekStart, weekEnd }
  );

  // Step 4: Select top articles
  const { selected } = await selectTopArticles(extracted, selectTop, weekLabel, discoveryDir);

  // Step 5: Merge into main articles.json
  const merged = await mergeDiscoveryArticles(selected, weekLabel);

  return { added: merged.added, updated: merged.updated };
}
