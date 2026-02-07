import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/env';
import { getCurrentIngestionWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';
import { getWeekRangeCET } from '../lib/utils/weekCET';
import { DateTime } from 'luxon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (must be before any env var access)
loadEnv();

// Import discovery modules AFTER env is loaded
import { generateSearchQueries } from '../discovery/queryDirector';
import { searchWithTavily } from '../discovery/searchProvider';
import { fetchAndExtractArticles } from '../discovery/fetchExtract';
import { selectTopArticles } from '../discovery/selectTop';
import { mergeDiscoveryArticles } from '../discovery/mergeArticles';
import type { Article } from '../ingestion/types';

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

// --- Configuration ---
type DiscoveryConfig = {
  weekLabel: string;
  maxCandidates: number;
  selectTop: number;
  searchProvider: 'tavily' | 'bing' | 'serpapi';
  regenDelta: boolean;
  noDelta: boolean;
};

function parseArgs(): DiscoveryConfig {
  const args = process.argv.slice(2);
  let weekLabel: string | null = null;
  let maxCandidates = 120;
  let selectTop = 20;
  let searchProvider: 'tavily' | 'bing' | 'serpapi' = 'tavily';
  let regenDelta = false;
  let noDelta = false;

  for (const arg of args) {
    if (arg.startsWith('--week=')) {
      weekLabel = arg.split('=')[1];
      if (!/^\d{4}-W\d{1,2}$/.test(weekLabel)) {
        console.error(`Invalid week format: ${weekLabel}. Expected YYYY-W## (e.g. 2026-W01)`);
        process.exit(1);
      }
    } else if (arg.startsWith('--maxCandidates=')) {
      maxCandidates = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--selectTop=')) {
      selectTop = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--searchProvider=')) {
      const provider = arg.split('=')[1];
      if (provider === 'tavily' || provider === 'bing' || provider === 'serpapi') {
        searchProvider = provider;
      }
    } else if (arg === '--regenDelta' || arg === '--regenDelta=true') {
      regenDelta = true;
    } else if (arg === '--noDelta' || arg === '--noDelta=true') {
      noDelta = true;
    }
  }

  if (!weekLabel) {
    weekLabel = getCurrentIngestionWeek();
  }
  validateWeekLabel(weekLabel);

  return { weekLabel, maxCandidates, selectTop, searchProvider, regenDelta, noDelta };
}

async function main() {
  const config = parseArgs();
  
  console.log('Web Discovery Configuration:');
  console.log(`  Week: ${config.weekLabel}`);
  console.log(`  Max candidates per category: ${config.maxCandidates}`);
  console.log(`  Select top per category: ${config.selectTop}`);
  console.log(`  Search provider: ${config.searchProvider}`);
  
  if (config.searchProvider === 'tavily' && !process.env.TAVILY_API_KEY) {
    console.error('Error: TAVILY_API_KEY not found in environment variables');
    process.exit(1);
  }
  console.log('');

  const weekDir = path.join(__dirname, '../data/weeks', config.weekLabel);
  const discoveryDir = path.join(weekDir, 'discovery');
  
  // Step 1: Generate search queries
  console.log('[Step 1] Generating search queries...');
  const queries = await generateSearchQueries(config.weekLabel, discoveryDir, {
    regenDelta: config.regenDelta,
    noDelta: config.noDelta
  });
  console.log(`✓ Generated ${Object.values(queries).flat().length} queries across ${Object.keys(queries).length} categories\n`);

  // Step 2: Search (with time-bound)
  console.log('[Step 2] Searching the web...');
  const { weekStart, weekEnd } = getWeekDates(config.weekLabel);
  const { results: searchResults, domainBreakdown } = await searchWithTavily(
    queries,
    config.maxCandidates,
    discoveryDir,
    { weekStart, weekEnd, weekLabel: config.weekLabel }
  );
  console.log(`✓ Found ${searchResults.length} candidate URLs`);
  console.log(`✓ Consultancy domains: ${domainBreakdown.consultancy} candidates\n`);

  // Step 3: Fetch and extract
  console.log('[Step 3] Fetching and extracting articles...');
  const { articles: extracted } = await fetchAndExtractArticles(
    searchResults,
    discoveryDir,
    { weekStart, weekEnd }
  );
  console.log(`✓ Extracted ${extracted.length} articles\n`);

  // Step 4: Select top articles
  console.log('[Step 4] Selecting top articles...');
  const { selected } = await selectTopArticles(extracted, config.selectTop, config.weekLabel, discoveryDir);
  console.log(`✓ Selected ${selected.length} articles\n`);

  // Step 5: Save discovery articles separately (week-scoped)
  console.log('[Step 5] Saving discovery articles...');
  const merged = await mergeDiscoveryArticles(selected, config.weekLabel);
  console.log(`✓ Saved ${merged.added} new discovery articles, ${merged.updated} updated (stored in data/weeks/${config.weekLabel}/discoveryArticles.json)\n`);

  console.log('Discovery complete!');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

