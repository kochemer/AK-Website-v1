/**
 * Weekly video digest planner
 * 
 * Creates a structured plan for video segments from a weekly digest.
 * No Sora calls yet - this is just the planning phase.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { WeeklyDigest, Article } from '../lib/types';

// ── Types ──────────────────────────────────────────────────────────

export interface VideoSegment {
  id: string; // e.g., "seg-01", "seg-02", "seg-outro"
  type: 'intro' | 'article' | 'outro';
  seconds: number;
  article?: {
    title: string;
    url: string;
    source: string;
    summary?: string;
  };
  motionTitle?: {
    concept: string; // Motion title concept for intro
  };
  bRoll?: {
    prompt: string; // Dynamic b-roll prompt for article segments
  };
  onScreenText?: string; // Short text to overlay on video
  voText?: string; // Voice-over text (1-2 sentences)
  ctaText?: string; // Call-to-action text for outro
}

export interface VideoPlan {
  weekLabel: string;
  generatedAt: string;
  aspect: 'portrait' | 'landscape' | 'square';
  secondsTarget: number;
  secondsActual: number;
  maxArticles: number;
  articlesSelected: number;
  segments: VideoSegment[];
}

// ── Main function ───────────────────────────────────────────────────

export interface BuildWeeklyVideoPlanOptions {
  weekLabel: string;
  maxArticles?: number;
  secondsTarget?: number;
  aspect?: 'portrait' | 'landscape' | 'square';
}

/**
 * Build a weekly video plan from a digest.
 */
export async function buildWeeklyVideoPlan(
  options: BuildWeeklyVideoPlanOptions
): Promise<VideoPlan> {
  const {
    weekLabel,
    maxArticles = 3,
    secondsTarget = 60,
    aspect = 'portrait',
  } = options;

  // Load digest
  const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
  const digestRaw = await fs.readFile(digestPath, 'utf-8');
  const digest: WeeklyDigest = JSON.parse(digestRaw);

  // Select top N articles across all topics
  const selectedArticles = selectTopArticles(digest, maxArticles);

  // Calculate segment durations — all segments 12s (Sora allows 4, 8, 12)
  const segmentSeconds = 12;
  const introSeconds = segmentSeconds;
  const outroSeconds = segmentSeconds;
  const articleSeconds = segmentSeconds;

  // Build segments
  const segments: VideoSegment[] = [];

  // Intro segment
  segments.push({
    id: 'seg-01',
    type: 'intro',
    seconds: introSeconds,
    motionTitle: {
      concept: `Weekly Intelligence Digest - ${weekLabel}`,
    },
  });

  // Article segments
  selectedArticles.forEach((article, index) => {
    const summary = article.aiSummary || article.snippet || '';
    const shortSummary = summary.length > 150 ? summary.substring(0, 147) + '...' : summary;
    
    // Generate b-roll prompt from article content
    const bRollPrompt = generateBRollPrompt(article);
    
    // Generate on-screen text (short, punchy)
    const onScreenText = article.title.length > 60 
      ? article.title.substring(0, 57) + '...'
      : article.title;
    
    // Generate VO text (1-2 sentences from summary)
    const voText = generateVOText(article, shortSummary);

    segments.push({
      id: `seg-${String(index + 2).padStart(2, '0')}`,
      type: 'article',
      seconds: articleSeconds,
      article: {
        title: article.title,
        url: article.url,
        source: article.source,
        summary: shortSummary,
      },
      bRoll: {
        prompt: bRollPrompt,
      },
      onScreenText,
      voText,
    });
  });

  // Outro segment
  segments.push({
    id: 'seg-outro',
    type: 'outro',
    seconds: outroSeconds,
    ctaText: 'Read more on luxury-intel.com',
  });

  const secondsActual = segments.reduce((sum, seg) => sum + seg.seconds, 0);

  return {
    weekLabel,
    generatedAt: new Date().toISOString(),
    aspect,
    secondsTarget,
    secondsActual,
    maxArticles,
    articlesSelected: selectedArticles.length,
    segments,
  };
}

/**
 * Select top N articles from digest, preferring articles with relevance scores.
 */
function selectTopArticles(digest: WeeklyDigest, maxArticles: number): Article[] {
  // Collect all top articles from all topics
  const allArticles: Article[] = [];
  
  for (const topicKey of ['AI_and_Strategy', 'Ecommerce_Retail_Tech', 'Luxury_and_Consumer', 'Jewellery_Industry'] as const) {
    const topic = digest.topics[topicKey];
    if (topic && topic.top) {
      allArticles.push(...topic.top);
    }
  }

  // Sort by relevance score if available, otherwise keep original order
  const sorted = allArticles.sort((a, b) => {
    const scoreA = a.relevance?.scoreTotal ?? 0;
    const scoreB = b.relevance?.scoreTotal ?? 0;
    if (scoreA !== scoreB) {
      return scoreB - scoreA; // Higher score first
    }
    return 0; // Keep original order if scores are equal
  });

  return sorted.slice(0, maxArticles);
}

/**
 * Generate a dynamic b-roll prompt from article content.
 */
function generateBRollPrompt(article: Article): string {
  const title = article.title.toLowerCase();
  const summary = (article.aiSummary || article.snippet || '').toLowerCase();
  const combined = `${title} ${summary}`;

  // Extract key concepts
  const keywords: string[] = [];
  
  // Look for industry terms
  if (combined.includes('ai') || combined.includes('artificial intelligence')) {
    keywords.push('technology', 'digital innovation');
  }
  if (combined.includes('ecommerce') || combined.includes('retail')) {
    keywords.push('shopping', 'online commerce', 'retail store');
  }
  if (combined.includes('luxury') || combined.includes('fashion')) {
    keywords.push('luxury goods', 'high-end fashion', 'premium products');
  }
  if (combined.includes('jewellery') || combined.includes('jewelry') || combined.includes('diamond')) {
    keywords.push('jewelry', 'diamonds', 'luxury accessories');
  }

  // Default to business/tech aesthetic if no specific keywords
  if (keywords.length === 0) {
    keywords.push('business', 'technology', 'modern workspace');
  }

  // Build prompt
  const basePrompt = `Dynamic b-roll footage: ${keywords.join(', ')}`;
  const style = article.source.includes('Tech') || article.source.includes('AI') 
    ? 'modern tech aesthetic, clean lines, professional'
    : 'sophisticated, elegant, premium quality';

  return `${basePrompt}, ${style}, cinematic, smooth camera movement`;
}

/**
 * Generate voice-over text (1-2 sentences) from article summary.
 */
function generateVOText(article: Article, summary: string): string {
  if (!summary || summary.trim().length === 0) {
    return `${article.title}. ${article.source} reports.`;
  }

  // Try to extract first 1-2 sentences
  const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (sentences.length >= 2) {
    return `${sentences[0].trim()}. ${sentences[1].trim()}.`;
  } else if (sentences.length === 1) {
    return `${sentences[0].trim()}.`;
  }

  // Fallback
  return summary.substring(0, 200).trim();
}

/**
 * Save video plan to disk.
 */
export async function saveVideoPlan(plan: VideoPlan, weekLabel: string): Promise<string> {
  const outputDir = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'video');
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, 'videoPlan.json');
  await fs.writeFile(outputPath, JSON.stringify(plan, null, 2), 'utf-8');
  
  return outputPath;
}
