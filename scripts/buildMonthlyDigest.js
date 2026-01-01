#!/usr/bin/env node
/**
 * Production-ready JavaScript entrypoint for building monthly digests.
 * This file can be run directly with Node.js after `next build` on Vercel.
 * It uses esbuild-register (via tsx) to enable TypeScript imports.
 */

import { createRequire } from 'module';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Note: This JS file should be run with tsx to enable TypeScript imports
// Example: npx tsx scripts/buildMonthlyDigest.js
// The API route and Vercel will use tsx automatically.
// If running directly with node, TypeScript imports will fail.

/**
 * Get the current month in Europe/Copenhagen timezone
 */
function getCurrentMonth() {
  const { DateTime } = require('luxon');
  const now = DateTime.now().setZone('Europe/Copenhagen');
  return now.toFormat('yyyy-MM');
}

/**
 * Parse CLI arguments for --month flag
 */
function parseArgs() {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith('--month=')) {
      const monthLabel = arg.split('=')[1];
      // Validate format
      if (!/^\d{4}-\d{2}$/.test(monthLabel)) {
        console.error(`Invalid month format: ${monthLabel}. Expected YYYY-MM`);
        process.exit(1);
      }
      return monthLabel;
    }
  }
  // Default to current month
  return getCurrentMonth();
}

async function main() {
  const monthLabel = parseArgs();
  
  console.log(`Building digest for month: ${monthLabel}\n`);
  
  try {
    // Import TypeScript modules (tsx loader will handle them)
    // Use .js extension in import path as per ESM convention for TS files
    const { buildMonthlyDigest } = await import('../digest/buildMonthlyDigest.js');
    const { getTopicTotalsDisplayName } = await import('../utils/topicNames.js');
    
    // Build the digest
    const digest = await buildMonthlyDigest(monthLabel);
    
    // Ensure output directory exists
    const outputDir = path.join(__dirname, '../data/digests');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Write JSON file
    const outputPath = path.join(outputDir, `${monthLabel}.json`);
    await fs.writeFile(
      outputPath,
      JSON.stringify(digest, null, 2),
      'utf-8'
    );
    
    // Log results
    console.log(`✓ Digest written to: ${outputPath}`);
    console.log(`\nSummary:`);
    console.log(`  Total articles: ${digest.totals.total}`);
    console.log(`  ${getTopicTotalsDisplayName('Jewellery')}: ${digest.totals.byTopic.Jewellery}`);
    console.log(`  ${getTopicTotalsDisplayName('Ecommerce')}: ${digest.totals.byTopic.Ecommerce}`);
    console.log(`  ${getTopicTotalsDisplayName('AIStrategy')}: ${digest.totals.byTopic.AIStrategy}`);
    console.log(`  ${getTopicTotalsDisplayName('Luxury')}: ${digest.totals.byTopic.Luxury}`);
    
  } catch (err) {
    console.error('Error building digest:', err);
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

