/**
 * CLI wrapper for weekly video plan builder
 */

import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';
import { buildWeeklyVideoPlan, saveVideoPlan } from '../video/buildWeeklyVideoPlan';

// Load environment variables (must be before any env var access)
loadEnv();

function parseArgs(): {
  week?: string;
  maxArticles?: number;
  secondsTarget?: number;
  aspect?: 'portrait' | 'landscape' | 'square';
  dryRun?: boolean;
} {
  const args = process.argv.slice(2);
  const options: ReturnType<typeof parseArgs> = {};

  for (const arg of args) {
    if (arg.startsWith('--week=')) {
      const week = arg.split('=')[1];
      validateWeekLabel(week);
      options.week = week;
    } else if (arg.startsWith('--maxArticles=')) {
      options.maxArticles = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--secondsTarget=')) {
      options.secondsTarget = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--aspect=')) {
      const aspect = arg.split('=')[1];
      if (aspect === 'portrait' || aspect === 'landscape' || aspect === 'square') {
        options.aspect = aspect;
      } else {
        console.error(`[VideoPlan] Invalid aspect: ${aspect}. Must be portrait, landscape, or square.`);
        process.exit(1);
      }
    } else if (arg === '--dryRun' || arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const weekLabel = options.week || getCurrentDigestWeek();

  console.log(`[VideoPlan] Building video plan for ${weekLabel}...`);

  try {
    const plan = await buildWeeklyVideoPlan({
      weekLabel,
      maxArticles: options.maxArticles,
      secondsTarget: options.secondsTarget,
      aspect: options.aspect,
    });

    // Print summary
    console.log(`\n[VideoPlan] Selected ${plan.articlesSelected} articles:`);
    plan.segments
      .filter(seg => seg.type === 'article')
      .forEach((seg, idx) => {
        if (seg.article) {
          console.log(`  ${idx + 1}. ${seg.article.title}`);
          console.log(`     Source: ${seg.article.source}`);
          console.log(`     Duration: ${seg.seconds}s`);
        }
      });

    console.log(`\n[VideoPlan] Total planned duration: ${plan.secondsActual}s (target: ${plan.secondsTarget}s)`);
    console.log(`[VideoPlan] Aspect ratio: ${plan.aspect}`);
    console.log(`[VideoPlan] Segments: ${plan.segments.length}`);
    console.log(`  - Intro: ${plan.segments.find(s => s.type === 'intro')?.seconds}s`);
    console.log(`  - Articles: ${plan.segments.filter(s => s.type === 'article').length} × ${plan.segments.find(s => s.type === 'article')?.seconds}s`);
    console.log(`  - Outro: ${plan.segments.find(s => s.type === 'outro')?.seconds}s`);

    if (options.dryRun) {
      console.log(`\n[VideoPlan] DRY RUN - Plan not saved to disk`);
      console.log(`[VideoPlan] Output would be: data/weeks/${weekLabel}/video/videoPlan.json`);
    } else {
      const outputPath = await saveVideoPlan(plan, weekLabel);
      console.log(`\n[VideoPlan] ✓ Saved plan to: ${outputPath}`);
    }

    process.exit(0);
  } catch (error) {
    console.error(`\n[VideoPlan] ✗ Error:`, error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
