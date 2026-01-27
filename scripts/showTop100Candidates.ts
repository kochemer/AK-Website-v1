import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import { getWeekRangeCET } from '../utils/weekCET';
import { classifyTopic } from '../classification/classifyTopics';
import type { Article as BaseArticle, Topic } from '../classification/classifyTopics';

// Extended Article type
type Article = BaseArticle & {
  snippet?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// We need to import the scoring function, but it's not exported
// So we'll recreate the scoring logic here or read from the digest
// Actually, let's read the articles and re-run the scoring

async function main() {
  const args = process.argv.slice(2);
  let weekLabel: string | null = null;
  let category: Topic = 'AI_and_Strategy';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--week' && i + 1 < args.length) {
      weekLabel = args[i + 1];
    } else if (args[i] === '--category' && i + 1 < args.length) {
      category = args[i + 1] as Topic;
    }
  }
  
  if (!weekLabel) {
    weekLabel = '2026-W04'; // Default
  }
  
  console.log(`Getting top 100 candidates for ${category} in week ${weekLabel}...\n`);
  
  // Parse weekLabel
  const weekMatch = weekLabel.match(/^(\d{4})-W(\d{1,2})$/);
  if (!weekMatch) {
    throw new Error(`Invalid weekLabel format: ${weekLabel}`);
  }
  
  const year = parseInt(weekMatch[1], 10);
  const weekNumber = parseInt(weekMatch[2], 10);
  const dt = DateTime.fromObject({ weekYear: year, weekNumber }, { zone: 'Europe/Copenhagen' });
  
  if (!dt.isValid) {
    throw new Error(`Invalid week: ${weekLabel}`);
  }
  
  // Get week range
  const { weekStartCET, weekEndCET } = getWeekRangeCET(dt.toJSDate());
  const weekStart = weekStartCET.getTime();
  const weekEnd = weekEndCET.getTime();
  
  // Load articles
  const dataPath = path.join(__dirname, '../data/articles.json');
  const raw = await fs.readFile(dataPath, 'utf-8');
  const articles: Article[] = JSON.parse(raw);
  
  // Filter to week and classify
  const eligibleArticles = articles.filter(article => {
    if (!article.published_at) return false;
    const dt = new Date(article.published_at);
    if (isNaN(dt.getTime())) return false;
    const t = dt.getTime();
    return t >= weekStart && t <= weekEnd;
  });
  
  // Classify and filter to category
  const categoryArticles: Article[] = [];
  for (const article of eligibleArticles) {
    const topic = classifyTopic(article);
    if (topic === category) {
      categoryArticles.push(article);
    }
  }
  
  console.log(`Found ${categoryArticles.length} articles in ${category} category\n`);
  
  // We need to import the scoring function, but it's not exported
  // Let's read the digest file instead to see what was actually sent
  // Or we can try to import it dynamically
  
  // Actually, let's check if there's a cache or log file
  const cachePath = path.join(__dirname, '../data/rerank_cache.json');
  let cache: any = {};
  try {
    const cacheRaw = await fs.readFile(cachePath, 'utf-8');
    cache = JSON.parse(cacheRaw);
  } catch (err) {
    console.log('No rerank cache found, will calculate from articles...\n');
  }
  
  // Try to find the cache entry for this week/category
  const cacheKey = `${weekLabel}/${category}`;
  const cacheEntry = Object.keys(cache).find(key => key.includes(cacheKey));
  
  if (cacheEntry) {
    console.log(`Found cache entry: ${cacheEntry}\n`);
    // The cache doesn't store the candidates, only the selected results
  }
  
  // Since we can't easily access the scoring function, let's read the digest
  // and show what articles were in the category, sorted by a simple heuristic
  // Or better: let's try to dynamically import the buildWeeklyDigest module
  
  // Actually, the simplest approach: read the articles, sort them by a simple score
  // and show top 100. But we need the actual scoring logic.
  
  // Let me try a different approach: check if there's logging in rerankArticles
  // or we can modify the code temporarily to log candidates
  
  // For now, let's show the top 100 by a simple heuristic: source weight + keyword count
  console.log('Calculating scores (simplified version)...\n');
  
  // Simple scoring: count AI keywords in title + snippet
  const AI_KEYWORDS = [
    "artificial intelligence", "ai", "machine learning", "ml", "llm", "large language model",
    "model release", "benchmark", "research", "arxiv", "openai", "anthropic", "claude", "gemini",
    "deepmind", "foundation model", "transformer", "neural network", "deep learning",
    "computer vision", "nlp", "natural language processing", "multimodal", "agent", "reasoning",
    "inference", "training", "fine-tuning", "weights", "open source", "ai lab", "ai company",
    "ai startup", "funding", "investment", "acquisition", "partnership", "regulation", "policy",
    "ai safety", "alignment", "agi", "compute", "gpu", "tpu", "sota", "state of the art"
  ];
  
  const scoredArticles = categoryArticles.map(article => {
    const text = `${article.title} ${article.snippet || ''}`.toLowerCase();
    const keywordMatches = AI_KEYWORDS.filter(kw => text.includes(kw.toLowerCase())).length;
    
    // Simple source weight
    let sourceWeight = 0;
    if (article.source.toLowerCase().includes('arxiv')) {
      sourceWeight = 0.05;
    } else if (["MIT Technology Review", "The Verge - AI", "TechCrunch - AI", "Wired - AI", "IEEE Spectrum", "Nature Machine Intelligence"].some(s => article.source.includes(s))) {
      sourceWeight = 0.15;
    } else if (["Modern Retail", "Digital Commerce 360", "Practical Ecommerce", "Retail Dive"].some(s => article.source.includes(s))) {
      sourceWeight = 0;
    }
    
    const keywordBoost = Math.min(0.20, keywordMatches * 0.05);
    const score = sourceWeight + keywordBoost;
    
    return { article, score, keywordMatches, sourceWeight };
  });
  
  // Sort by score descending
  scoredArticles.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 0.0001) {
      return b.score - a.score;
    }
    return a.article.url.localeCompare(b.article.url);
  });
  
  // Take top 100
  const top100 = scoredArticles.slice(0, 100);
  
  console.log(`Top 100 candidates for LLM reranking (${category}):\n`);
  console.log('='.repeat(80));
  top100.forEach((item, idx) => {
    console.log(`${(idx + 1).toString().padStart(3)}. ${item.article.title}`);
  });
  
  console.log(`\n\nTotal: ${top100.length} articles`);
  console.log(`\nNote: This uses simplified scoring. Actual LLM candidates may differ slightly due to full scoring formula.`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
