/**
 * CLI wrapper for video captions builder
 */

import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';
import { buildWeeklyVideoCaptions } from '../video/buildWeeklyVideoCaptions';

// Load environment variables (must be before any env var access)
loadEnv();

function parseArgs(): { week?: string } {
  const args = process.argv.slice(2);
  const options: ReturnType<typeof parseArgs> = {};

  for (const arg of args) {
    if (arg.startsWith('--week=')) {
      const week = arg.split('=')[1];
      validateWeekLabel(week);
      options.week = week;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const weekLabel = options.week || getCurrentDigestWeek();

  console.log(`[VideoCaptions] Building captions for ${weekLabel}...`);

  try {
    const captionsPath = await buildWeeklyVideoCaptions({ weekLabel });
    console.log(`\n[VideoCaptions] ✓ Captions saved to: ${captionsPath}`);
    process.exit(0);
  } catch (error) {
    console.error(`\n[VideoCaptions] ✗ Error:`, error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
