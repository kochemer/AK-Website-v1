import { promises as fs, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'dotenv';
import { buildWeeklyDigest } from '../digest/buildWeeklyDigest';
import { generateSummariesForDigest } from '../digest/generateSummaries';
import { DateTime } from 'luxon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local');
  try {
    const buffer = readFileSync(envPath);
    let contentToParse: string;
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
      contentToParse = buffer.toString('utf16le', 2);
    } else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
      const leBuffer = Buffer.alloc(buffer.length - 2);
      for (let i = 2; i < buffer.length; i += 2) {
        leBuffer[i - 2] = buffer[i + 1];
        leBuffer[i - 1] = buffer[i];
      }
      contentToParse = leBuffer.toString('utf16le');
    } else if (buffer.length > 0 && buffer[1] === 0 && buffer[0] !== 0) {
      contentToParse = buffer.toString('utf16le');
    } else {
      contentToParse = buffer.toString('utf-8');
    }
    const parsed = parse(contentToParse);
    Object.assign(process.env, parsed);
  } catch (err) {
    // .env.local not found, continue
  }
}

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
    // Default to previous week
    const now = DateTime.now().setZone('Europe/Copenhagen');
    const prevWeek = now.minus({ weeks: 1 });
    const weekNum = prevWeek.weekNumber.toString().padStart(2, '0');
    weekLabel = `${prevWeek.year}-W${weekNum}`;
  }
  
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
