/**
 * CLI wrapper for weekly pipeline orchestrator
 */

import { loadEnv } from '../lib/env';
import { runWeeklyPipeline, type RunWeeklyPipelineOptions } from '../pipeline/runWeeklyPipeline';
import { validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';

// Load environment variables (must be before any env var access)
loadEnv();

function parseArgs(): RunWeeklyPipelineOptions {
  const args = process.argv.slice(2);
  const options: RunWeeklyPipelineOptions = {};

  for (const arg of args) {
    if (arg.startsWith('--week=')) {
      const week = arg.split('=')[1];
      validateWeekLabel(week);
      options.week = week;
    } else if (arg.startsWith('--ingestionWeek=')) {
      const ingestionWeek = arg.split('=')[1];
      validateWeekLabel(ingestionWeek);
      options.ingestionWeek = ingestionWeek;
    } else if (arg === '--skipPodcast' || arg === '--skipPodcast=true') {
      options.skipPodcast = true;
    } else if (arg === '--skipCover' || arg === '--skipCover=true') {
      options.skipCover = true;
    } else if (arg === '--skipDiscovery' || arg === '--skipDiscovery=true') {
      options.skipDiscovery = true;
    } else if (arg === '--skipClassification' || arg === '--skipClassification=true') {
      options.skipClassification = true;
    } else if (arg === '--skipEmail' || arg === '--skipEmail=true') {
      options.skipEmail = true;
    } else if (arg === '--skipDigest' || arg === '--skipDigest=true') {
      options.skipDigest = true;
    } else if (arg === '--forceRebuild' || arg === '--forceRebuild=true') {
      options.forceRebuild = true;
    } else if (arg.startsWith('--maxTotalArticles=')) {
      options.maxTotalArticles = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--maxArticlesPerCategory=')) {
      options.maxArticlesPerCategory = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--minArticlesPerCategory=')) {
      options.minArticlesPerCategory = parseInt(arg.split('=')[1], 10);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  try {
    const result = await runWeeklyPipeline(options);

    // Check if any step failed
    const failedSteps = result.steps.filter(s => !s.ok);
    if (failedSteps.length > 0) {
      console.error(`\n[Pipeline] ✗ Pipeline completed with ${failedSteps.length} failed step(s)`);
      process.exit(1);
    }

    console.log(`\n[Pipeline] ✓ Pipeline completed successfully`);
    process.exit(0);
  } catch (error) {
    console.error(`\n[Pipeline] ✗ Fatal error:`, error);
    process.exit(1);
  }
}

main();
