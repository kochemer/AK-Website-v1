/**
 * CLI wrapper for final video composition
 */

import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';
import { buildWeeklyVideoCaptions } from '../video/buildWeeklyVideoCaptions';
import { buildWeeklyVideoVoiceover } from '../video/buildWeeklyVideoVoiceover';
import { composeWeeklyVideo } from '../video/composeWeeklyVideo';
import { promises as fs } from 'fs';
import path from 'path';

// Load environment variables (must be before any env var access)
loadEnv();

function parseArgs(): { week?: string; dryRun?: boolean } {
  const args = process.argv.slice(2);
  const options: ReturnType<typeof parseArgs> = {};

  for (const arg of args) {
    if (arg.startsWith('--week=')) {
      const week = arg.split('=')[1];
      validateWeekLabel(week);
      options.week = week;
    } else if (arg === '--dryRun' || arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const weekLabel = options.week || getCurrentDigestWeek();
  const dryRun = options.dryRun || false;

  console.log(`[VideoFinal] Building final video for ${weekLabel}...`);
  if (dryRun) {
    console.log(`[VideoFinal] DRY RUN mode`);
  }

  try {
    // Step 1: Build captions
    console.log(`\n[VideoFinal] Step 1: Building captions...`);
    await buildWeeklyVideoCaptions({ weekLabel });

    // Step 2: Build voiceover (text always; audio if ELEVENLABS_API_KEY set)
    console.log(`\n[VideoFinal] Step 2: Building voiceover...`);
    let voiceoverPath: string | undefined;
    try {
      const voResult = await buildWeeklyVideoVoiceover({ weekLabel, dryRun: false });
      try {
        await fs.access(voResult.voiceoverWavPath);
        voiceoverPath = voResult.voiceoverWavPath;
      } catch {
        // vo.wav not created (no API key or no voText)
      }
    } catch (error: any) {
      console.error(`[VideoFinal] Voiceover error:`, error.message);
      throw error;
    }

    // Step 3: Compose final video (no subtitles for now; voiceover if generated)
    console.log(`\n[VideoFinal] Step 3: Composing final video...`);
    const result = await composeWeeklyVideo({
      week: weekLabel,
      dryRun,
      voiceoverPath,
    });

    console.log(`\n[VideoFinal] ✓ Output paths:`);
    console.log(`  Final: ${result.outputPath}`);

    process.exit(0);
  } catch (error) {
    console.error(`\n[VideoFinal] ✗ Error:`, error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
