import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import { getWeekRangeCET } from '../lib/utils/weekCET';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const weekLabel = '2026-W04';
  
  // Parse week to get date range
  const weekMatch = weekLabel.match(/^(\d{4})-W(\d{1,2})$/);
  if (!weekMatch) {
    throw new Error(`Invalid weekLabel: ${weekLabel}`);
  }
  
  const year = parseInt(weekMatch[1], 10);
  const weekNumber = parseInt(weekMatch[2], 10);
  const dt = DateTime.fromObject({ weekYear: year, weekNumber }, { zone: 'Europe/Copenhagen' });
  const { weekStartCET, weekEndCET } = getWeekRangeCET(dt.toJSDate());
  
  const weekStart = weekStartCET.getTime();
  const weekEnd = weekEndCET.getTime();
  
  // Load articles
  const articlesPath = path.join(__dirname, '../data/articles.json');
  const raw = await fs.readFile(articlesPath, 'utf-8');
  const articles = JSON.parse(raw);
  
  console.log(`Before: ${articles.length} articles`);
  
  // Filter out Arxiv articles from week 4
  const filtered = articles.filter((article: any) => {
    const isArxiv = article.source?.toLowerCase().includes('arxiv');
    
    if (!isArxiv) {
      return true; // Keep non-Arxiv articles
    }
    
    // For Arxiv articles, check if they're in week 4
    if (!article.published_at) {
      return true; // Keep if no date (shouldn't happen, but safe)
    }
    
    const pubDate = new Date(article.published_at).getTime();
    const inWeek4 = pubDate >= weekStart && pubDate <= weekEnd;
    
    // Remove if it's Arxiv AND in week 4
    return !inWeek4;
  });
  
  const removed = articles.length - filtered.length;
  console.log(`After: ${filtered.length} articles`);
  console.log(`Removed: ${removed} Arxiv articles from week 4`);
  
  // Save filtered articles
  await fs.writeFile(articlesPath, JSON.stringify(filtered, null, 2), 'utf-8');
  
  // Verify
  const weekArticles = filtered.filter((article: any) => {
    if (!article.published_at) return false;
    const pubDate = new Date(article.published_at).getTime();
    return pubDate >= weekStart && pubDate <= weekEnd;
  });
  
  const arxivInWeek = weekArticles.filter((article: any) => 
    article.source?.toLowerCase().includes('arxiv')
  ).length;
  
  console.log(`\nVerification:`);
  console.log(`Week ${weekLabel} articles: ${weekArticles.length}`);
  console.log(`Arxiv articles remaining: ${arxivInWeek}`);
  
  if (arxivInWeek === 0) {
    console.log(`✓ SUCCESS: All Arxiv articles removed from week 4`);
  } else {
    console.log(`⚠ WARNING: ${arxivInWeek} Arxiv articles still present`);
  }
}

main().catch(console.error);
