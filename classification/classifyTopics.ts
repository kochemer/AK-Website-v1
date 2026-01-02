import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getWeekRangeCET } from '../utils/weekCET';

// --- Types ---
export type Topic =
  | "AI_and_Strategy"
  | "Ecommerce_Retail_Tech"
  | "Luxury_and_Consumer"
  | "Jewellery_Industry";

export type Article = {
  id: string;
  title: string;
  url: string;
  source: string;
  published_at: string;
  ingested_at: string;
};

// --- Topic heuristics ---

// Priority order for assignment if multiple match
// AI_and_Strategy > Ecommerce_Retail_Tech > Luxury_and_Consumer > Jewellery_Industry
const TOPIC_PRIORITY: Topic[] = [
  "AI_and_Strategy",
  "Ecommerce_Retail_Tech",
  "Luxury_and_Consumer",
  "Jewellery_Industry"
];

// Heuristic keyword lists (lowercase all for case-insensitive match)
const JEWELLERY_KEYWORDS = [
  "jewel", "jewellery", "jewelry", "diamond", "gold", "silver", "gem", "gems",
  "fancy color", "carat", "cartier", "tiffany", "bulgari", "harry winston",
  "gemstone", "precious stone", "van cleef", "luxury watch", "horology",
  "de beers", "sotheby’s", "graff", "piaget"
];

const AI_ECOMMERCE_KEYWORDS = [
  "ai", "artificial intelligence", "machine learning", "ml model", "llm",
  "chatgpt", "gpt-", "openai", "generative", "personalization", "recommender",
  "recommendation", "predictive", "data-driven", "algorithm", "automation", 
  "data science", "computer vision", "nlp", "large language", "deep learning",
  "prompt", "foundation model"
];

const LUXURY_BEHAVIOUR_KEYWORDS = [
  "consumer", "behaviour", "behavior", "consumer insights", "affluent",
  "luxury shopper", "vip", "purchase intent", "brand loyalty", "spending",
  "trend", "trends", "market research", "demographic", "psychographic",
  "demand", "customer journey", "connoisseur", "collectors", "high net worth",
  "motivation", "desire", "experiential"
];

const ECOMMERCE_KEYWORDS = [
  "ecommerce", "e-commerce", "online store", "webshop", "marketplace",
  "shopify", "cart", "checkout", "payment", "digital storefront", "dropshipping",
  "conversion", "fulfillment", "shipment", "online retail", "cross-border",
  "platform", "magento", "bigcommerce", "shop system", "omnichannel", "logistics",
  "commerce cloud", "woocommerce"
];

// Source name matches for obvious routing
const JEWELLERY_SOURCES = [
  "Rapaport", "National Jeweler", "JCK", "Jeweller Magazine", "Professional Jeweller", "JewelleryNet"
];

// Helper: Lowercase test for any keyword present
function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

export function classifyTopic(article: { title: string; url: string; source: string }): Topic {
  const titleAndSource = `${article.title} ${article.source}`.toLowerCase();
  
  // Collect all matching topics (in priority order)
  const matches: Topic[] = [];
  
  // Check AI & Strategy first (highest priority)
  if (matchesAnyKeyword(titleAndSource, AI_ECOMMERCE_KEYWORDS)) {
    matches.push("AI_and_Strategy");
  }
  
  // Check Ecommerce & Retail Tech
  if (matchesAnyKeyword(titleAndSource, ECOMMERCE_KEYWORDS)) {
    matches.push("Ecommerce_Retail_Tech");
  }
  
  // Check Luxury & Consumer
  if (matchesAnyKeyword(titleAndSource, LUXURY_BEHAVIOUR_KEYWORDS)) {
    matches.push("Luxury_and_Consumer");
  }
  
  // Check Jewellery Industry (lowest priority, but source override takes precedence)
  if (JEWELLERY_SOURCES.some(s => 
    article.source && article.source.toLowerCase().includes(s.toLowerCase())
  )) {
    return "Jewellery_Industry";
  }
  if (matchesAnyKeyword(titleAndSource, JEWELLERY_KEYWORDS)) {
    matches.push("Jewellery_Industry");
  }
  
  // Return first match in priority order (AI_and_Strategy > Ecommerce_Retail_Tech > Luxury_and_Consumer > Jewellery_Industry)
  for (const priorityTopic of TOPIC_PRIORITY) {
    if (matches.includes(priorityTopic)) {
      return priorityTopic;
    }
  }
  
  // Broad fallback: if looks consumer-ish use "Luxury_and_Consumer"
  const fallbackConsumerish = ["consumer", "shopper", "customer", "retail", "buy", "seller", "trend"];
  if (matchesAnyKeyword(titleAndSource, fallbackConsumerish)) {
    return "Luxury_and_Consumer";
  }
  
  // Default fallback: "Ecommerce_Retail_Tech"
  return "Ecommerce_Retail_Tech";
}

// --- CET week filtering and classification ---

async function getArticlesPath(): Promise<string> {
  // __dirname isn't allowed; use import.meta.url to get path
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, "../data/articles.json");
}

export async function classifyCurrentWeekArticles(
  inputDate?: Date
): Promise<{ weekLabel: string; byTopic: Record<Topic, Article[]> }> {
  const dataPath = await getArticlesPath();

  // Filter-to-CET-week logic uses getWeekRangeCET
  const { weekStartCET, weekEndCET, weekLabel } = getWeekRangeCET(inputDate ?? new Date());

  let articles: Article[] = [];
  try {
    const raw = await fs.readFile(dataPath, 'utf-8');
    articles = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read articles.json:', (err as Error).message);
    return { weekLabel: weekLabel, byTopic: {
      "AI_and_Strategy": [],
      "Ecommerce_Retail_Tech": [],
      "Luxury_and_Consumer": [],
      "Jewellery_Industry": [],
    }};
  }

  const weekStart = weekStartCET.getTime();
  const weekEnd = weekEndCET.getTime();

  // Only consider articles whose published_at falls in CET week span
  const eligibleArticles = articles.filter(article => {
    if (!article.published_at) return false;
    const dt = new Date(article.published_at);
    if (isNaN(dt.getTime())) return false;
    const t = dt.getTime();
    return t >= weekStart && t <= weekEnd;
  });

  // Group articles by topic
  const byTopic: Record<Topic, Article[]> = {
    "AI_and_Strategy": [],
    "Ecommerce_Retail_Tech": [],
    "Luxury_and_Consumer": [],
    "Jewellery_Industry": [],
  };

  for (const article of eligibleArticles) {
    const topic = classifyTopic(article);
    byTopic[topic].push(article);
  }

  return { weekLabel: weekLabel, byTopic };
}

// --- CLI runner ---

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.includes('classifyTopics.ts')) {
  classifyCurrentWeekArticles()
    .then(({ weekLabel, byTopic }) => {
      console.log(weekLabel);
      for (const topic of TOPIC_PRIORITY) {
        const count = byTopic[topic].length;
        console.log(`${topic}: ${count}`);
      }
      process.exit(0);
    })
    .catch(err => {
      console.error('Classification failed:', err);
      process.exit(1);
    });
}

