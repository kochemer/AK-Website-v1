/**
 * Build weekly email digest: single ranked list of top N articles with sharp bullets
 * Phase 1: Generate JSON artifact only (no email sending)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { computeCommerceMateriality, getTopByMateriality } from '../scoring/commerceMateriality';
import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';
import type { Article, WeeklyDigest, EmailDigest, EmailDigestItem } from '../lib/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (must be before any env var access)
loadEnv();

// Configuration
const EMAIL_DIGEST_MODEL = process.env.EMAIL_DIGEST_MODEL || 'gpt-4o-mini';
const TEMPERATURE = 0.3;
const MAX_TOKENS = 500;

// Commerce Materiality weights
const COMMERCE_MATERIALITY_WEIGHT_ECOM = parseFloat(process.env.COMMERCE_MATERIALITY_WEIGHT_ECOM || '1.5');
const COMMERCE_MATERIALITY_WEIGHT_EMAIL = parseFloat(process.env.COMMERCE_MATERIALITY_WEIGHT_EMAIL || '1.2');
const COMMERCE_MATERIALITY_WEIGHT_OTHER = parseFloat(process.env.COMMERCE_MATERIALITY_WEIGHT_OTHER || '0.3');


/**
 * Load full text if available (from podcast fulltext)
 */
async function loadFullText(articleId: string, weekLabel: string): Promise<string | null> {
  try {
    const fulltextPath = path.join(__dirname, '../data/weeks', weekLabel, 'podcast', 'fulltext', `${articleId}.html`);
    const content = await fs.readFile(fulltextPath, 'utf-8');
    // Extract text content (simple extraction, remove HTML tags)
    const text = content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > 100 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Select and rank articles for email digest
 * Deterministic selection pattern:
 * 1. top 1 from cat 1 (Ecommerce_Retail_Tech)
 * 2. top 1 from cat 2 (Jewellery_Industry)
 * 3. top 1 from cat 3 (AI_and_Strategy)
 * 4. top 1 from cat 4 (Luxury_and_Consumer)
 * 5. top 2 from cat 1 (Ecommerce_Retail_Tech)
 * 6. top 2 from cat 3 (AI_and_Strategy)
 * 7. top 2 from cat 2 (Jewellery_Industry)
 * 8. top 3 from cat 1 (Ecommerce_Retail_Tech)
 */
function selectAndRankArticles(digest: WeeklyDigest, topN: number): Array<Article & { commerceMaterialityScore: number; commerceMaterialitySignals: string[] }> {
  const categoryOrder: Array<keyof WeeklyDigest['topics']> = [
    'Ecommerce_Retail_Tech',     // cat 1
    'Jewellery_Industry',       // cat 2
    'AI_and_Strategy',          // cat 3
    'Luxury_and_Consumer'      // cat 4
  ];
  
  // Selection pattern: [categoryIndex, rankIndex] where rankIndex is 0-based
  const selectionPattern = [
    [0, 0], // top 1 from cat 1 (Ecommerce_Retail_Tech)
    [1, 0], // top 1 from cat 2 (Jewellery_Industry)
    [2, 0], // top 1 from cat 3 (AI_and_Strategy)
    [3, 0], // top 1 from cat 4 (Luxury_and_Consumer)
    [0, 1], // top 2 from cat 1 (Ecommerce_Retail_Tech)
    [2, 1], // top 2 from cat 3 (AI_and_Strategy)
    [1, 1], // top 2 from cat 2 (Jewellery_Industry)
    [0, 2], // top 3 from cat 1 (Ecommerce_Retail_Tech)
  ];
  
  const selected: Array<Article & { commerceMaterialityScore: number; commerceMaterialitySignals: string[] }> = [];
  const seen = new Set<string>();
  
  // Process selection pattern
  for (const [categoryIdx, rankIdx] of selectionPattern) {
    if (selected.length >= topN) break;
    
    const categoryKey = categoryOrder[categoryIdx];
    const topic = digest.topics[categoryKey];
    
    if (topic && topic.top && topic.top.length > rankIdx) {
      const article = topic.top[rankIdx];
      
      // Skip if already selected (duplicate check)
      if (seen.has(article.url)) {
        // Try next article from same category
        let found = false;
        for (let i = rankIdx + 1; i < topic.top.length; i++) {
          const nextArticle = topic.top[i];
          if (!seen.has(nextArticle.url)) {
            const materiality = computeCommerceMateriality({
              title: nextArticle.title,
              source: nextArticle.source,
              snippet: nextArticle.snippet,
              aiSummary: nextArticle.aiSummary
            });
            
            selected.push({
              id: nextArticle.id,
              title: nextArticle.title,
              url: nextArticle.url,
              source: nextArticle.source,
              published_at: nextArticle.published_at,
              ingested_at: nextArticle.ingested_at,
              snippet: nextArticle.snippet,
              aiSummary: nextArticle.aiSummary,
              commerceMaterialityScore: materiality.score,
              commerceMaterialitySignals: materiality.signals
            });
            seen.add(nextArticle.url);
            found = true;
            break;
          }
        }
        if (!found) continue; // Skip if no available article from this category
      } else {
        // Compute materiality score for the article
        const materiality = computeCommerceMateriality({
          title: article.title,
          source: article.source,
          snippet: article.snippet,
          aiSummary: article.aiSummary
        });
        
        selected.push({
          id: article.id,
          title: article.title,
          url: article.url,
          source: article.source,
          published_at: article.published_at,
          ingested_at: article.ingested_at,
          snippet: article.snippet,
          aiSummary: article.aiSummary,
          commerceMaterialityScore: materiality.score,
          commerceMaterialitySignals: materiality.signals
        });
        seen.add(article.url);
      }
    }
  }
  
  // Return exactly topN (or fewer if not enough articles available)
  return selected.slice(0, topN);
}

/**
 * Generate bullets for an article using LLM
 */
async function generateBullets(
  article: Article,
  weekLabel: string,
  apiKey: string
): Promise<string[]> {
  // Try to load full text
  let articleText = article.aiSummary || article.snippet || '';
  const fullText = await loadFullText(article.id, weekLabel);
  if (fullText) {
    // Use first 2000 chars of full text
    articleText = fullText.substring(0, 2000);
  }
  
  if (!articleText || articleText.length < 50) {
    // Fallback: create simple bullets from title
    return [
      article.title,
      'Read the full article for details.'
    ];
  }
  
  const openai = new OpenAI({ apiKey });
  
  const prompt = `You are writing bullets for a weekly intelligence digest (THE FORMAT style).

Article:
Title: ${article.title}
Source: ${article.source}
Content: ${articleText.substring(0, 2000)}

Generate 2-3 bullets following these rules:
- Max 18 words per bullet
- Bullets #1-2: Summary of what happened (not rephrasing headline)
- Bullet #3 (if needed): "So what" implications for retail/luxury/AI operators and strategists
- Avoid generic verbs: "explores", "highlights", "discusses", "examines"
- Use specific, concrete language
- No controversy, war, or culture-war content
- Focus on actionable insights for business readers

Output as JSON object with a "bullets" array:
{"bullets": ["bullet 1", "bullet 2", "bullet 3"]}`;

  try {
    const response = await openai.chat.completions.create({
      model: EMAIL_DIGEST_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You output ONLY valid JSON objects with a "bullets" array, no markdown, no code blocks.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in LLM response');
    }
    
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    }
    
    const parsed = JSON.parse(jsonContent);
    
    // Extract bullets from response
    let bullets: string[] = [];
    if (Array.isArray(parsed.bullets)) {
      bullets = parsed.bullets;
    } else if (Array.isArray(parsed)) {
      bullets = parsed;
    } else if (parsed.bullet1 || parsed.bullet2) {
      bullets = [parsed.bullet1, parsed.bullet2, parsed.bullet3].filter(Boolean);
    }
    
    // Validate and clean bullets
    bullets = bullets
      .filter(b => typeof b === 'string' && b.trim().length > 0)
      .map(b => b.trim())
      .slice(0, 3); // Max 3 bullets
    
    if (bullets.length === 0) {
      // Fallback
      bullets = [article.title];
    }
    
    return bullets;
  } catch (error) {
    console.warn(`[EmailDigest] Failed to generate bullets for "${article.title}": ${(error as Error).message}`);
    // Fallback
    return [article.title];
  }
}

/**
 * Generate intro paragraph (optional)
 */
async function generateIntro(
  articles: Article[],
  weekLabel: string,
  apiKey: string
): Promise<string | undefined> {
  const openai = new OpenAI({ apiKey });
  
  const titles = articles.map(a => a.title).join(', ');
  
  const prompt = `Write a 2-3 sentence intro framing the week's intelligence digest.

Week: ${weekLabel}
Top articles: ${titles}

Keep it brief, professional, and set context for a retail/luxury/AI intelligence reader.`;

  try {
    const response = await openai.chat.completions.create({
      model: EMAIL_DIGEST_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You write concise, professional introductions for intelligence digests.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: TEMPERATURE,
      max_tokens: 150
    });
    
    const content = response.choices[0]?.message?.content?.trim();
    return content || undefined;
  } catch (error) {
    console.warn(`[EmailDigest] Failed to generate intro: ${(error as Error).message}`);
    return undefined;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let weekLabel: string | null = null;
  let topN = 8;
  let force = false;
  
  for (const arg of args) {
    if (arg.startsWith('--week=')) {
      weekLabel = arg.split('=')[1];
      if (!/^\d{4}-W\d{1,2}$/.test(weekLabel)) {
        console.error(`Invalid week format: ${weekLabel}. Expected YYYY-W##`);
        process.exit(1);
      }
    } else if (arg.startsWith('--topN=')) {
      topN = parseInt(arg.split('=')[1], 10);
      if (isNaN(topN) || topN < 1 || topN > 20) {
        console.error(`Invalid topN: ${topN}. Must be between 1 and 20`);
        process.exit(1);
      }
    } else if (arg === '--force') {
      force = true;
    }
  }
  
  if (!weekLabel) {
    weekLabel = getCurrentDigestWeek();
    console.log(`[EmailDigest] No --week provided, using computed digest week: ${weekLabel}`);
  }
  validateWeekLabel(weekLabel);
  
  // Check if already exists
  const outputPath = path.join(__dirname, '../data/weeks', weekLabel, 'email-digest.json');
  if (!force) {
    try {
      await fs.access(outputPath);
      console.log(`Email digest already exists for ${weekLabel}. Use --force to regenerate.`);
      process.exit(0);
    } catch {
      // File doesn't exist, proceed
    }
  }
  
  // Load weekly digest
  const digestPath = path.join(__dirname, '../data/digests', `${weekLabel}.json`);
  let digest: WeeklyDigest;
  try {
    const content = await fs.readFile(digestPath, 'utf-8');
    digest = JSON.parse(content);
  } catch (error) {
    console.error(`Error: Could not load digest from ${digestPath}`);
    console.error(`Make sure you've run buildWeeklyDigest for week ${weekLabel} first.`);
    process.exit(1);
  }
  
  console.log(`Building email digest for ${weekLabel}...`);
  console.log(`  Top N: ${topN}`);
  console.log('');
  
  // Select and rank articles
  const selectedArticles = selectAndRankArticles(digest, topN);
  console.log(`Selected ${selectedArticles.length} articles:`);
  selectedArticles.forEach((a, i) => {
    console.log(`  ${i + 1}. ${a.title} (${a.source})`);
    console.log(`      Materiality: ${a.commerceMaterialityScore}/10 (${a.commerceMaterialitySignals.join(', ')})`);
  });
  console.log('');
  
  // Report top 10 by materiality across all categories
  console.log(`=== Commerce Materiality Top 10 ===`);
  const allArticles: Array<Article & { commerceMaterialityScore: number; commerceMaterialitySignals: string[] }> = [];
  for (const categoryKey of ['AI_and_Strategy', 'Ecommerce_Retail_Tech', 'Luxury_and_Consumer', 'Jewellery_Industry'] as const) {
    const topic = digest.topics[categoryKey];
    if (topic && topic.top) {
      for (const article of topic.top) {
        const materiality = computeCommerceMateriality({
          title: article.title,
          source: article.source,
          snippet: article.snippet,
          aiSummary: article.aiSummary
        });
        allArticles.push({
          ...article,
          commerceMaterialityScore: materiality.score,
          commerceMaterialitySignals: materiality.signals
        });
      }
    }
  }
  
  // Sort by materiality score
  allArticles.sort((a, b) => b.commerceMaterialityScore - a.commerceMaterialityScore);
  const top10 = allArticles.slice(0, 10);
  top10.forEach((article, idx) => {
    console.log(`  ${idx + 1}. [${article.commerceMaterialityScore}/10] ${article.title}`);
    console.log(`      Signals: ${article.commerceMaterialitySignals.join(', ')}`);
  });
  console.log('');
  
  // Get API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY not found in environment');
    process.exit(1);
  }
  
  // Generate intro
  console.log('Generating intro...');
  const intro = await generateIntro(selectedArticles, weekLabel, apiKey);
  if (intro) {
    console.log(`✓ Intro: ${intro.substring(0, 80)}...`);
  }
  console.log('');
  
  // Generate bullets for each article
  console.log('Generating bullets...');
  const items: EmailDigestItem[] = [];
  
  for (let i = 0; i < selectedArticles.length; i++) {
    const article = selectedArticles[i];
    console.log(`  [${i + 1}/${selectedArticles.length}] ${article.title}`);
    
    const bullets = await generateBullets(article, weekLabel, apiKey);
    items.push({
      rank: i + 1,
      title: article.title,
      url: article.url,
      source: article.source,
      bullets
    });
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('');
  
  // Select "read one thing" (top article)
  const readOneThing = items.length > 0 ? {
    title: items[0].title,
    url: items[0].url
  } : undefined;
  
  // Build email digest
  const emailDigest: EmailDigest = {
    week: weekLabel,
    generatedAt: new Date().toISOString(),
    intro,
    readOneThing,
    items
  };
  
  // Save to file
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(emailDigest, null, 2), 'utf-8');
  
  console.log(`✓ Email digest saved to: ${outputPath}`);
  console.log(`  Items: ${items.length}`);
  console.log(`  Intro: ${intro ? 'Yes' : 'No'}`);
  console.log(`  Read One Thing: ${readOneThing ? 'Yes' : 'No'}`);
}

// Run if invoked directly
main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
