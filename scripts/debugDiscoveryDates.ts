import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type DateSourceDetail = 'jsonld' | 'meta' | 'time' | 'time_text' | 'tavily' | 'none';

function parseArgs() {
  const args = process.argv.slice(2);
  let weekLabel: string | null = null;
  let limit: number | null = null;

  for (const arg of args) {
    if (arg.startsWith('--week=')) {
      weekLabel = arg.split('=')[1];
    } else if (arg === '--week' && args.length > 0) {
      const idx = args.indexOf(arg);
      if (idx >= 0 && args[idx + 1]) {
        weekLabel = args[idx + 1];
      }
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    }
  }

  if (!weekLabel) {
    console.error('Usage: npx tsx scripts/debugDiscoveryDates.ts --week=YYYY-W## [--limit=100]');
    process.exit(1);
  }

  return { weekLabel, limit };
}

async function main() {
  const { weekLabel, limit } = parseArgs();
  const discoveryDir = path.join(__dirname, '../data/weeks', weekLabel, 'discovery');
  const extractedDir = path.join(discoveryDir, 'extracted');
  const discoveryArticlesPath = path.join(__dirname, '../data/weeks', weekLabel, 'discoveryArticles.json');
  const searchReportPath = path.join(discoveryDir, 'search-report.json');
  const extractionReportPath = path.join(discoveryDir, 'extraction-report.json');

  const files = (await fs.readdir(extractedDir)).filter(f => f.endsWith('.json'));
  const selectedFiles = limit ? files.slice(0, limit) : files;

  const detailCounts: Record<DateSourceDetail, number> = {
    jsonld: 0,
    meta: 0,
    time: 0,
    time_text: 0,
    tavily: 0,
    none: 0
  };

  let missingPublishedAt = 0;
  const missingDomains = new Map<string, number>();

  for (const file of selectedFiles) {
    const item = JSON.parse(await fs.readFile(path.join(extractedDir, file), 'utf-8'));
    const publishedAt = item.publishedAt ?? item.publishedDate ?? null;
    const detail = (item.dateSourceDetail || item.dateSource || 'none') as DateSourceDetail;
    const domain = item.domain || 'unknown';

    if (detailCounts[detail] === undefined) {
      detailCounts.none += 1;
    } else {
      detailCounts[detail] += 1;
    }

    if (!publishedAt) {
      missingPublishedAt += 1;
      missingDomains.set(domain, (missingDomains.get(domain) || 0) + 1);
    }
  }

  let assignedByDiscoveredAt = 0;
  let droppedByExcludeDomain = 0;
  let droppedByUrlPattern = 0;
  let droppedByNotLikelyArticle = 0;
  let droppedByDomainRule = 0;
  try {
    const discoveryArticles = JSON.parse(await fs.readFile(discoveryArticlesPath, 'utf-8'));
    assignedByDiscoveredAt = discoveryArticles.filter((a: any) => a.usedDiscoveredAtFallback).length;
  } catch {
    // Ignore if discoveryArticles.json doesn't exist yet
  }

  try {
    const searchReport = JSON.parse(await fs.readFile(searchReportPath, 'utf-8'));
    droppedByExcludeDomain = searchReport.droppedByExcludeDomain || 0;
    droppedByUrlPattern = searchReport.droppedByUrlPattern || 0;
    droppedByDomainRule = searchReport.droppedByDomainRule || 0;
  } catch {
    // Ignore if search report doesn't exist yet
  }

  try {
    const extractionReport = JSON.parse(await fs.readFile(extractionReportPath, 'utf-8'));
    for (const topic of Object.values(extractionReport.byTopic || {})) {
      const excluded = (topic as any).excluded || {};
      droppedByNotLikelyArticle += excluded.notLikelyArticle || 0;
    }
  } catch {
    // Ignore if extraction report doesn't exist yet
  }

  console.log(`Discovery dates summary for ${weekLabel}`);
  console.log(`- Extracted files analyzed: ${selectedFiles.length}`);
  console.log(`- Missing publishedAt: ${missingPublishedAt}`);
  console.log(`- Parsed via jsonld: ${detailCounts.jsonld}`);
  console.log(`- Parsed via meta: ${detailCounts.meta}`);
  console.log(`- Parsed via time: ${detailCounts.time}`);
  console.log(`- Parsed via time_text: ${detailCounts.time_text}`);
  console.log(`- Parsed via tavily: ${detailCounts.tavily}`);
  console.log(`- Date source none: ${detailCounts.none}`);
  console.log(`- Assigned by discoveredAt: ${assignedByDiscoveredAt}`);
  console.log(`- Dropped by exclude domain: ${droppedByExcludeDomain}`);
  console.log(`- Dropped by url pattern: ${droppedByUrlPattern}`);
  console.log(`- Dropped by domain rule: ${droppedByDomainRule}`);
  console.log(`- Dropped by not likely article: ${droppedByNotLikelyArticle}`);
  console.log(`- Remaining extracted: ${selectedFiles.length}`);

  const topMissingDomains = [...missingDomains.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (topMissingDomains.length > 0) {
    console.log('\nTop 10 domains for missing published dates:');
    for (const [domain, count] of topMissingDomains) {
      console.log(`- ${domain}: ${count}`);
    }
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
