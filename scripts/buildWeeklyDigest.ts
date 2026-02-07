import { promises as fs } from 'fs';
import path from 'path';
import { buildWeeklyDigest } from '../digest/buildWeeklyDigest';
import { generateSummariesForDigest } from '../digest/generateSummaries';
import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';

// Load environment variables (must be before any env var access)
loadEnv();

async function main() {
  // Get week from command line args or default to previous week
  const args = process.argv.slice(2);
  let weekLabel: string | null = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--week' && i + 1 < args.length) {
      weekLabel = args[i + 1];
      break;
    }
    if (args[i].startsWith('--week=')) {
      weekLabel = args[i].split('=')[1];
      break;
    }
  }
  
  if (!weekLabel) {
    weekLabel = getCurrentDigestWeek();
  }
  validateWeekLabel(weekLabel);
  
  console.log(`[Build Weekly Digest] Building digest for ${weekLabel}...`);
  
  try {
    const digest = await buildWeeklyDigest(weekLabel);
    
    // Generate AI summaries for all top articles
    console.log(`[Build Weekly Digest] Generating AI summaries for articles...`);
    const summaryStats = await generateSummariesForDigest(digest);
    console.log(`[Build Weekly Digest] Summary generation complete - Succeeded: ${summaryStats.succeeded}, Skipped: ${summaryStats.skipped}, Failed: ${summaryStats.failed}`);
    
    // Save to data/digests/{weekLabel}.json
    const outputDir = path.join(process.cwd(), 'data', 'digests');
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${weekLabel}.json`);
    
    // Preserve cover image fields from existing digest (if any)
    try {
      const existing = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
      if (existing.coverImageUrl && !(digest as any).coverImageUrl) {
        (digest as any).coverImageUrl = existing.coverImageUrl;
      }
      if (existing.coverImageAlt && !(digest as any).coverImageAlt) {
        (digest as any).coverImageAlt = existing.coverImageAlt;
      }
    } catch {
      // No existing digest — that's fine
    }
    
    await fs.writeFile(outputPath, JSON.stringify(digest, null, 2), 'utf-8');
    
    console.log(`[Build Weekly Digest] ✓ Saved digest to ${outputPath}`);
    console.log(`[Build Weekly Digest] Total articles: ${digest.totals.total}`);
    console.log(`[Build Weekly Digest] By topic:`);
    console.log(`  - AI & Strategy: ${digest.totals.byTopic.AIStrategy} (top ${digest.topics.AI_and_Strategy.top.length})`);
    console.log(`  - Ecommerce & Retail Tech: ${digest.totals.byTopic.EcommerceRetail} (top ${digest.topics.Ecommerce_Retail_Tech.top.length})`);
    console.log(`  - Luxury & Consumer: ${digest.totals.byTopic.LuxuryConsumer} (top ${digest.topics.Luxury_and_Consumer.top.length})`);
    console.log(`  - Jewellery Industry: ${digest.totals.byTopic.Jewellery} (top ${digest.topics.Jewellery_Industry.top.length})`);
  } catch (error) {
    console.error(`[Build Weekly Digest] ✗ Error:`, error);
    process.exit(1);
  }
}

main();
