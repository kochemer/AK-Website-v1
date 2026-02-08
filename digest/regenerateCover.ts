/**
 * Module function for regenerating cover image
 * Extracted from scripts/regenerateCover.ts for use by orchestrator
 */

import { promises as fs } from 'fs';
import path from 'path';
import { generateWeeklyCoverImage } from './generateCoverImage';
import type { WeeklyDigest } from '../lib/types';

/**
 * Extract homepage top articles from digest
 */
function extractHomepageTopArticles(digest: WeeklyDigest): Array<{
  title: string;
  source?: string;
  snippet?: string;
  aiSummary?: string;
  rerankWhy?: string;
}> {
  const homepageArticles: Array<{
    title: string;
    source?: string;
    snippet?: string;
    aiSummary?: string;
    rerankWhy?: string;
  }> = [];
  
  // Top 1-2 from Ecommerce_Retail_Tech
  const ecommerceTop = digest.topics?.Ecommerce_Retail_Tech?.top || [];
  homepageArticles.push(...ecommerceTop.slice(0, 2).map((article: any) => ({
    title: article.title,
    source: article.source,
    snippet: article.snippet,
    aiSummary: article.aiSummary,
    rerankWhy: article.rerankWhy,
  })));
  
  // Top 1-2 from Jewellery_Industry
  const jewelleryTop = digest.topics?.Jewellery_Industry?.top || [];
  homepageArticles.push(...jewelleryTop.slice(0, 2).map((article: any) => ({
    title: article.title,
    source: article.source,
    snippet: article.snippet,
    aiSummary: article.aiSummary,
    rerankWhy: article.rerankWhy,
  })));
  
  return homepageArticles;
}

/**
 * Update digest JSON with new cover image path
 */
async function updateDigestCoverPath(weekLabel: string, imagePath: string): Promise<void> {
  const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
  
  try {
    const digestContent = await fs.readFile(digestPath, 'utf-8');
    const digest = JSON.parse(digestContent);
    
    digest.coverImageUrl = imagePath;
    digest.coverImageAlt = `Weekly cover illustration for ${weekLabel}`;
    
    await fs.writeFile(digestPath, JSON.stringify(digest, null, 2), 'utf-8');
  } catch (error) {
    console.warn(`⚠ Could not update digest JSON: ${(error as Error).message}`);
  }
}

/**
 * Regenerate cover image for a week
 */
export async function regenerateCover(weekLabel: string, variant: 'safe' | 'fun' = 'safe'): Promise<{ success: boolean; imagePath?: string }> {
  // Load digest
  const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
  const digestContent = await fs.readFile(digestPath, 'utf-8');
  const digest: WeeklyDigest = JSON.parse(digestContent);

  // Extract homepage top articles
  const homepageTopArticles = extractHomepageTopArticles(digest);
  
  if (homepageTopArticles.length === 0) {
    throw new Error(`No homepage articles found in digest for week ${weekLabel}`);
  }

  // Generate cover image
  const coverResult = await generateWeeklyCoverImage(
    weekLabel,
    homepageTopArticles,
    true, // regenCover = true
    'realistic', // Always use realistic style
    variant
  );
  
  if (coverResult.success && coverResult.imagePath) {
    // Update digest JSON
    await updateDigestCoverPath(weekLabel, coverResult.imagePath);
    return { success: true, imagePath: coverResult.imagePath };
  } else {
    throw new Error('Cover image generation failed');
  }
}
