import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { type Variant } from '../digest/sceneDirector';
import { generateWeeklyCoverImage } from '../digest/generateCoverImage';
import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (must be before any env var access)
loadEnv();

type CoverInput = {
  weekLabel: string;
  homepageTopArticles: Array<{
    title: string;
    source?: string;
    snippet?: string;
    aiSummary?: string;
    rerankWhy?: string;
  }>;
  prompt: string;
  finalImagePrompt?: string; // New field from Scene Director
  coverStyle: 'realistic' | 'illustration';
  variant?: 'safe' | 'fun'; // New field
  generatedAt: string;
};

/**
 * Update digest JSON with new cover image path
 */
async function updateDigestCoverPath(weekLabel: string, imagePath: string): Promise<void> {
  const digestPath = path.join(__dirname, '../data/digests', `${weekLabel}.json`);
  
  try {
    const digestContent = await fs.readFile(digestPath, 'utf-8');
    const digest = JSON.parse(digestContent);
    
    digest.coverImageUrl = imagePath;
    digest.coverImageAlt = `Weekly cover illustration for ${weekLabel}`;
    
    await fs.writeFile(digestPath, JSON.stringify(digest, null, 2), 'utf-8');
    console.log(`✓ Updated digest JSON with new cover path`);
  } catch (error) {
    console.warn(`⚠ Could not update digest JSON: ${(error as Error).message}`);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): { weekLabel: string; variant: Variant } {
  const args = process.argv.slice(2);
  let weekLabel: string | null = null;
  let variant: Variant = 'safe';
  
  for (const arg of args) {
    if (arg.startsWith('--week=')) {
      weekLabel = arg.split('=')[1];
      if (!/^\d{4}-W\d{1,2}$/.test(weekLabel)) {
        console.error(`Invalid week format: ${weekLabel}. Expected YYYY-W## (e.g. 2026-W01)`);
        process.exit(1);
      }
    } else if (arg.startsWith('--variant=')) {
      const v = arg.split('=')[1];
      if (v === 'safe' || v === 'fun') {
        variant = v;
      } else {
        console.warn(`Invalid variant: ${v}. Using default: safe`);
      }
    }
  }
  
  if (!weekLabel) {
    weekLabel = getCurrentDigestWeek();
    console.log(`[Cover] No --week provided, using computed digest week: ${weekLabel}`);
  }
  validateWeekLabel(weekLabel);
  
  return { weekLabel, variant };
}

/**
 * Extract homepage top articles from current digest
 * Homepage shows: top 1-2 from Ecommerce_Retail_Tech and top 1-2 from Jewellery_Industry
 */
function extractHomepageTopArticles(digest: any): Array<{
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
 * Main function
 */
async function main() {
  const { weekLabel, variant } = parseArgs();
  
  console.log(`Regenerating cover image for week: ${weekLabel}`);
  console.log(`  Variant: ${variant}`);
  console.log('');
  
  // Load CURRENT digest to get up-to-date homepage articles
  const digestPath = path.join(__dirname, '../data/digests', `${weekLabel}.json`);
  let digest: any;
  try {
    const digestContent = await fs.readFile(digestPath, 'utf-8');
    digest = JSON.parse(digestContent);
  } catch (error) {
    console.error(`Error: Could not load digest from ${digestPath}`);
    console.error(`Make sure you've run buildWeeklyDigest for week ${weekLabel} first.`);
    process.exit(1);
  }
  
  // Extract homepage top articles from CURRENT digest
  const homepageTopArticles = extractHomepageTopArticles(digest);
  
  if (homepageTopArticles.length === 0) {
    console.error(`Error: No homepage articles found in digest for week ${weekLabel}`);
    console.error(`Make sure the digest has top articles in Ecommerce_Retail_Tech and Jewellery_Industry.`);
    process.exit(1);
  }
  
  console.log(`Loaded CURRENT digest for ${weekLabel}`);
  console.log(`  Homepage articles: ${homepageTopArticles.map(a => a.title).join(', ')}`);
  console.log('');

  // Use the new 2-step pipeline with CURRENT homepage articles
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
    console.log('');
    console.log(`✓ Cover image regeneration complete!`);
    console.log(`  Image: public/weekly-images/${weekLabel}.png`);
    console.log(`  Digest updated: data/digests/${weekLabel}.json`);
  } else {
    console.error('✗ Cover image generation failed');
    process.exit(1);
  }
}

// Run if invoked directly
main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

