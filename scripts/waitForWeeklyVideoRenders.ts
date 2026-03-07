/**
 * CLI: wait for weekly video segment renders to be READY before composing.
 */

import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';
import { waitForWeeklyVideoRenders } from '../video/waitForWeeklyVideoRenders';

loadEnv();

function parseArgs(): { week?: string; timeoutMin?: number; pollSec?: number } {
  const args = process.argv.slice(2);
  const options: ReturnType<typeof parseArgs> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--week=')) {
      const week = arg.split('=')[1];
      validateWeekLabel(week);
      options.week = week;
    } else if (arg === '--week' && i + 1 < args.length) {
      validateWeekLabel(args[i + 1]);
      options.week = args[++i];
    } else if (arg.startsWith('--timeoutMin=')) {
      options.timeoutMin = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--timeoutMin' && i + 1 < args.length) {
      options.timeoutMin = parseInt(args[++i], 10);
    } else if (arg.startsWith('--pollSec=')) {
      options.pollSec = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--pollSec' && i + 1 < args.length) {
      options.pollSec = parseInt(args[++i], 10);
    }
  }

  return options;
}

async function main() {
  const opts = parseArgs();
  const week = opts.week ?? getCurrentDigestWeek();
  const timeoutMin = opts.timeoutMin ?? 60;
  const pollSec = opts.pollSec ?? 20;

  console.log(`[VideoWait] Waiting for segments (week=${week}, timeout=${timeoutMin}min, poll=${pollSec}s)\n`);

  const { ready, reason } = await waitForWeeklyVideoRenders({
    week,
    timeoutMin,
    pollSec,
  });

  if (ready) {
    process.exit(0);
  }
  console.error(`[VideoWait] ✗ ${reason ?? 'Not all segments ready'}`);
  process.exit(1);
}

main();
