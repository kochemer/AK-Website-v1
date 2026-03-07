/**
 * CLI wrapper for video clip rendering
 */

import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';
import { renderWeeklyVideoClips, type RenderConfig } from '../video/renderWeeklyVideoClips';

// Load environment variables (must be before any env var access)
loadEnv();

function parseArgs(): RenderConfig {
  const args = process.argv.slice(2);
  const config: RenderConfig = {
    weekLabel: getCurrentDigestWeek(),
  };

  for (const arg of args) {
    if (arg.startsWith('--week=')) {
      const week = arg.split('=')[1];
      validateWeekLabel(week);
      config.weekLabel = week;
    } else if (arg.startsWith('--model=')) {
      config.model = arg.split('=')[1];
    } else if (arg.startsWith('--aspect=')) {
      const aspect = arg.split('=')[1];
      if (aspect === 'portrait' || aspect === 'landscape') {
        config.aspect = aspect;
      } else {
        console.error(`[VideoRender] Invalid aspect: ${aspect}. Must be portrait or landscape.`);
        process.exit(1);
      }
    } else if (arg.startsWith('--size=')) {
      config.size = arg.split('=')[1];
    } else if (arg.startsWith('--concurrency=')) {
      config.concurrency = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--maxSegments=')) {
      config.maxSegments = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--dryRun' || arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--resumeFailed' || arg === '--resume-failed') {
      config.resumeFailed = true;
    }
  }

  return config;
}

async function main() {
  const config = parseArgs();

  console.log(`[VideoRender] Rendering clips for ${config.weekLabel}...`);
  if (config.dryRun) {
    console.log(`[VideoRender] DRY RUN mode - no API calls will be made`);
  }
  if (config.resumeFailed) {
    console.log(`[VideoRender] RESUME mode - will retry failed segments only`);
  }

  try {
    const result = await renderWeeklyVideoClips(config);

    // Print summary
    console.log(`\n[VideoRender] Summary:`);
    console.log(`  Cached: ${result.cached}`);
    console.log(`  Rendered: ${result.rendered}`);
    console.log(`  Failed: ${result.failed}`);
    if (result.skippedDueToBilling > 0) {
      console.log(`  Skipped (billing limit): ${result.skippedDueToBilling}`);
    }
    console.log(`  Total: ${result.outputs.length}`);

    if (result.outputs.length > 0) {
      console.log(`\n[VideoRender] Outputs:`);
      for (const output of result.outputs) {
        const status = output.status === 'cached' ? '✓' : output.status === 'rendered' ? '→' : '✗';
        console.log(`  ${status} ${output.segmentId}: ${output.path || '(failed)'}`);
      }
    }

    const reportPath = `data/weeks/${config.weekLabel}/video/videoRender.json`;
    console.log(`\n[VideoRender] Report saved to: ${reportPath}`);

    if (result.failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error(`\n[VideoRender] ✗ Error:`, error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
