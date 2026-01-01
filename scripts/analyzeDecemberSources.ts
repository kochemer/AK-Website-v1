import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SOURCE_FEEDS, SOURCE_PAGES } from '../ingestion/sources.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Load December digest
  const digestPath = path.join(__dirname, '../data/digests/2025-12.json');
  const digest = JSON.parse(await fs.readFile(digestPath, 'utf-8'));

// Create sets of source names for quick lookup
const rssSourceNames = new Set(SOURCE_FEEDS.map(feed => feed.name));
const pageSourceNames = new Set(SOURCE_PAGES.map(page => page.name));

// Analyze each category
const categories = [
  { key: 'JewelleryIndustry', name: 'Jewellery Industry' },
  { key: 'EcommerceTechnology', name: 'Ecommerce Technology' },
  { key: 'AIEcommerceStrategy', name: 'AI & Ecommerce Strategy' },
  { key: 'LuxuryConsumerBehaviour', name: 'Luxury Consumer Behaviour' }
];

console.log('=== December 2025 Top 7 Articles by Category - Source Analysis ===\n');

let totalRSS = 0;
let totalPage = 0;

for (const category of categories) {
  const topicData = digest.topics[category.key];
  const topArticles = topicData.top.slice(0, 7);
  
  if (topArticles.length === 0) {
    console.log(`${category.name}: No articles\n`);
    continue;
  }
  
  console.log(`${category.name} (${topArticles.length} articles):`);
  
  let categoryRSS = 0;
  let categoryPage = 0;
  const rssArticles: string[] = [];
  const pageArticles: string[] = [];
  
  for (const article of topArticles) {
    const source = article.source;
    if (rssSourceNames.has(source)) {
      categoryRSS++;
      rssArticles.push(`  - ${article.title} (${source})`);
    } else if (pageSourceNames.has(source)) {
      categoryPage++;
      pageArticles.push(`  - ${article.title} (${source})`);
    } else {
      // Unknown source - if not in page sources, assume it's RSS
      // (since ingestion only has RSS and Page fetching methods)
      categoryRSS++;
      rssArticles.push(`  - ${article.title} (${source}) [RSS - not in current source list]`);
    }
  }
  
  totalRSS += categoryRSS;
  totalPage += categoryPage;
  
  console.log(`  RSS: ${categoryRSS} articles`);
  console.log(`  Page Fetching: ${categoryPage} articles\n`);
  
  if (rssArticles.length > 0) {
    console.log('  RSS Articles:');
    rssArticles.forEach(a => console.log(a));
    console.log('');
  }
  
  if (pageArticles.length > 0) {
    console.log('  Page Fetching Articles:');
    pageArticles.forEach(a => console.log(a));
    console.log('');
  }
}

  console.log('=== Summary ===');
  console.log(`Total RSS Articles: ${totalRSS}`);
  console.log(`Total Page Fetching Articles: ${totalPage}`);
  console.log(`Total Articles Analyzed: ${totalRSS + totalPage}`);
}

main().catch(console.error);

