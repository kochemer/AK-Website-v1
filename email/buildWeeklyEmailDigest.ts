/**
 * Module function for building weekly email digest
 * Extracted from scripts/buildWeeklyEmailDigest.ts for use by orchestrator
 */

import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { computeCommerceMateriality } from '../scoring/commerceMateriality';
import type { Article, WeeklyDigest, EmailDigest, EmailDigestItem } from '../lib/types';

const EMAIL_DIGEST_MODEL = process.env.EMAIL_DIGEST_MODEL || 'gpt-4o-mini';
const TEMPERATURE = 0.3;
const MAX_TOKENS = 500;

/**
 * Load full text if available (from podcast fulltext)
 */
async function loadFullText(articleId: string, weekLabel: string): Promise<string | null> {
  try {
    const fulltextPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'podcast', 'fulltext', `${articleId}.html`);
    const content = await fs.readFile(fulltextPath, 'utf-8');
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
 */
function selectAndRankArticles(digest: WeeklyDigest, topN: number): Array<Article & { commerceMaterialityScore: number; commerceMaterialitySignals: string[] }> {
  const categoryOrder: Array<keyof WeeklyDigest['topics']> = [
    'Ecommerce_Retail_Tech',
    'Jewellery_Industry',
    'AI_and_Strategy',
    'Luxury_and_Consumer',
  ];
  
  const selectionPattern = [
    [0, 0], [1, 0], [2, 0], [3, 0],
    [0, 1], [2, 1], [1, 1], [0, 2],
  ];
  
  const selected: Array<Article & { commerceMaterialityScore: number; commerceMaterialitySignals: string[] }> = [];
  const seen = new Set<string>();
  
  for (const [categoryIdx, rankIdx] of selectionPattern) {
    if (selected.length >= topN) break;
    
    const categoryKey = categoryOrder[categoryIdx];
    const topic = digest.topics[categoryKey];
    
    if (topic && topic.top && topic.top.length > rankIdx) {
      const article = topic.top[rankIdx];
      
      if (seen.has(article.url)) {
        continue;
      }
      
      const materiality = computeCommerceMateriality({
        title: article.title,
        source: article.source,
        snippet: article.snippet,
        aiSummary: article.aiSummary,
      });
      
      selected.push({
        ...article,
        commerceMaterialityScore: materiality.score,
        commerceMaterialitySignals: materiality.signals,
      });
      seen.add(article.url);
    }
  }
  
  return selected.slice(0, topN);
}

/**
 * Generate bullets for an article using LLM
 */
async function generateBullets(article: Article, weekLabel: string, apiKey: string): Promise<string[]> {
  let articleText = article.aiSummary || article.snippet || '';
  const fullText = await loadFullText(article.id, weekLabel);
  if (fullText) {
    articleText = fullText.substring(0, 2000);
  }
  
  if (!articleText || articleText.length < 50) {
    return [article.title, 'Read the full article for details.'];
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
          content: 'You output ONLY valid JSON objects with a "bullets" array, no markdown, no code blocks.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
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
    
    let bullets: string[] = [];
    if (Array.isArray(parsed.bullets)) {
      bullets = parsed.bullets;
    } else if (Array.isArray(parsed)) {
      bullets = parsed;
    } else if (parsed.bullet1 || parsed.bullet2) {
      bullets = [parsed.bullet1, parsed.bullet2, parsed.bullet3].filter(Boolean);
    }
    
    bullets = bullets
      .filter(b => typeof b === 'string' && b.trim().length > 0)
      .map(b => b.trim())
      .slice(0, 3);
    
    if (bullets.length === 0) {
      bullets = [article.title];
    }
    
    return bullets;
  } catch (error) {
    console.warn(`[EmailDigest] Failed to generate bullets for "${article.title}": ${(error as Error).message}`);
    return [article.title];
  }
}

/**
 * Generate intro paragraph (optional)
 */
async function generateIntro(articles: Article[], weekLabel: string, apiKey: string): Promise<string | undefined> {
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
          content: 'You write concise, professional introductions for intelligence digests.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: TEMPERATURE,
      max_tokens: 150,
    });
    
    const content = response.choices[0]?.message?.content?.trim();
    return content || undefined;
  } catch (error) {
    console.warn(`[EmailDigest] Failed to generate intro: ${(error as Error).message}`);
    return undefined;
  }
}

/**
 * Build weekly email digest
 */
export async function buildWeeklyEmailDigest(weekLabel: string, topN: number = 8): Promise<EmailDigest> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment');
  }

  // Load weekly digest
  const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
  const digestContent = await fs.readFile(digestPath, 'utf-8');
  const digest: WeeklyDigest = JSON.parse(digestContent);

  // Select and rank articles
  const selectedArticles = selectAndRankArticles(digest, topN);

  // Generate intro
  const intro = await generateIntro(selectedArticles, weekLabel, apiKey);

  // Generate bullets for each article
  const items: EmailDigestItem[] = [];
  for (let i = 0; i < selectedArticles.length; i++) {
    const article = selectedArticles[i];
    const bullets = await generateBullets(article, weekLabel, apiKey);
    items.push({
      rank: i + 1,
      title: article.title,
      url: article.url,
      source: article.source,
      bullets,
    });
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Select "read one thing" (top article)
  const readOneThing = items.length > 0 ? {
    title: items[0].title,
    url: items[0].url,
  } : undefined;

  // Build email digest
  const emailDigest: EmailDigest = {
    week: weekLabel,
    generatedAt: new Date().toISOString(),
    intro,
    readOneThing,
    items,
  };

  // Save to file
  const outputPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'email-digest.json');
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(emailDigest, null, 2), 'utf-8');

  return emailDigest;
}
