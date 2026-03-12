import { promises as fs } from 'fs';
import path from 'path';
import { buildWeeklyDigest } from '../digest/buildWeeklyDigest';
import { generateSummariesForDigest } from '../digest/generateSummaries';
import { generateThemesForDigest } from '../digest/generateThemes';
import { translateDigestArticles } from '../lib/i18n/translate';
import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';
import { runWeeklyChecks, printHealthCheckResults } from '../pipeline/checks/runChecks';

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
    
    // Generate one-sentence summary for the week
    console.log(`[Build Weekly Digest] Generating one-sentence summary...`);
    const themesResult = await generateThemesForDigest(digest);
    if (themesResult?.oneSentenceSummary) {
      (digest as any).oneSentenceSummary = themesResult.oneSentenceSummary;
      console.log(`[Build Weekly Digest] ✓ One-sentence summary: "${themesResult.oneSentenceSummary}"`);
    } else {
      console.warn(`[Build Weekly Digest] ⚠ One-sentence summary generation skipped or failed`);
    }

    // Translate article titles + summaries into DA/ES
    console.log(`[Build Weekly Digest] Translating articles into DA/ES...`);
    const allTopArticles = [
      ...digest.topics.AI_and_Strategy.top,
      ...digest.topics.Ecommerce_Retail_Tech.top,
      ...digest.topics.Luxury_and_Consumer.top,
      ...digest.topics.Jewellery_Industry.top,
    ];
    const { translations, stats: translateStats } = await translateDigestArticles(allTopArticles);
    
    // Attach translations to each article in the digest
    for (const article of allTopArticles) {
      const t = translations.get(article.title);
      if (t) {
        article.translations = t;
      }
    }
    console.log(`[Build Weekly Digest] Translation complete - Total: ${translateStats.total}, Cached: ${translateStats.cached}, Translated: ${translateStats.translated}, Failed: ${translateStats.failed}`);
    
    // Validate translations: check DA/ES titles differ from English
    let translationMisses = 0;
    for (const article of allTopArticles) {
      if (!article.translations?.da?.title || article.translations.da.title === article.title) {
        console.warn(`[Build Weekly Digest] ⚠ DA translation missing or identical for: "${article.title.substring(0, 60)}..."`);
        translationMisses++;
      }
      if (!article.translations?.es?.title || article.translations.es.title === article.title) {
        console.warn(`[Build Weekly Digest] ⚠ ES translation missing or identical for: "${article.title.substring(0, 60)}..."`);
        translationMisses++;
      }
    }
    if (translationMisses > 0) {
      console.warn(`[Build Weekly Digest] ⚠ ${translationMisses} translation misses detected (see warnings above)`);
    } else {
      console.log(`[Build Weekly Digest] ✓ All translations validated successfully`);
    }
    
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
    
    // Run health checks before saving
    // Try to load podcast script if available (optional)
    let podcastScriptText: string | undefined;
    try {
      const podcastScriptPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'podcast-script.txt');
      podcastScriptText = await fs.readFile(podcastScriptPath, 'utf-8');
    } catch {
      // Podcast script not available - that's fine, check will be skipped
    }

    const checkResult = runWeeklyChecks({
      digest,
      selectedArticles: allTopArticles,
      podcastScriptText,
    });
    printHealthCheckResults(checkResult);

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
