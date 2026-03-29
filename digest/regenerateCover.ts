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
 *
 * Smart selection strategy to reduce repetitive jewelry imagery:
 * - Always take top 1-2 from Ecommerce_Retail_Tech (primary focus)
 * - For Jewellery_Industry: take only top 1 (not 2) to reduce dominance
 * - If Jewellery quality is weak, prefer other topics instead
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

  // Top 1-2 from Ecommerce_Retail_Tech (primary topic)
  const ecommerceTop = digest.topics?.Ecommerce_Retail_Tech?.top || [];
  homepageArticles.push(...ecommerceTop.slice(0, 2).map((article: any) => ({
    title: article.title,
    source: article.source,
    snippet: article.snippet,
    aiSummary: article.aiSummary,
    rerankWhy: article.rerankWhy,
  })));

  // Top 1 from Jewellery_Industry (NOT 2 - reduce repetition)
  const jewelleryTop = digest.topics?.Jewellery_Industry?.top || [];
  if (jewelleryTop.length > 0) {
    const topJewel = jewelleryTop[0] as any;
    homepageArticles.push({
      title: topJewel.title,
      source: topJewel.source,
      snippet: topJewel.snippet,
      aiSummary: topJewel.aiSummary,
      rerankWhy: topJewel.rerankWhy,
    });
  }

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
