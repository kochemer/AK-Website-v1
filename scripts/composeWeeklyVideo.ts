/**
 * CLI wrapper for weekly video composition
 */

import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';
import { composeWeeklyVideo, type ComposeOptions } from '../video/composeWeeklyVideo';
import { promises as fs } from 'fs';
import path from 'path';

// Load environment variables (must be before any env var access)
loadEnv();

function parseArgs(): ComposeOptions {
  const args = process.argv.slice(2);
  const options: Partial<ComposeOptions> = {};

  for (const arg of args) {
    if (arg.startsWith('--week=')) {
      const week = arg.split('=')[1];
      validateWeekLabel(week);
      options.week = week;
    } else if (arg.startsWith('--week')) {
      // Handle --week 2026-W06 format
      const idx = args.indexOf(arg);
      if (idx + 1 < args.length) {
        const week = args[idx + 1];
        validateWeekLabel(week);
        options.week = week;
      }
    } else if (arg.startsWith('--voiceover=')) {
      options.voiceoverPath = arg.split('=')[1];
    } else if (arg.startsWith('--voiceover')) {
      const idx = args.indexOf(arg);
      if (idx + 1 < args.length) {
        options.voiceoverPath = args[idx + 1];
      }
    } else if (arg.startsWith('--subtitles=')) {
      options.subtitlesPath = arg.split('=')[1];
    } else if (arg.startsWith('--subtitles')) {
      const idx = args.indexOf(arg);
      if (idx + 1 < args.length) {
        options.subtitlesPath = args[idx + 1];
      }
    } else if (arg === '--burnSubtitles' || arg === '--burn-subtitles') {
      options.burnSubtitles = true;
    }
  }

  if (!options.week) {
    options.week = getCurrentDigestWeek();
  }

  return options as ComposeOptions;
}

async function main() {
  const options = parseArgs();

  console.log(`[VideoCompose] Composing video for ${options.week}...`);

  // Auto-detect voiceover and subtitles if not provided
  const videoDir = path.join(process.cwd(), 'data', 'weeks', options.week, 'video');
  
  if (!options.voiceoverPath) {
    const defaultVoiceover = path.join(videoDir, 'vo.wav');
    try {
      await fs.access(defaultVoiceover);
      options.voiceoverPath = defaultVoiceover;
      console.log(`[VideoCompose] Auto-detected voiceover: ${defaultVoiceover}`);
    } catch {
      console.log(`[VideoCompose] No voiceover provided, using original audio`);
    }
  }

  // Subtitles disabled by default; pass --subtitles /path/to.srt to enable
  if (!options.subtitlesPath) {
    console.log(`[VideoCompose] No subtitles (disabled)`);
  }

  try {
    const result = await composeWeeklyVideo(options);

    console.log(`\n[VideoCompose] ✓ Composition complete`);
    console.log(`  Output: ${result.outputPath}`);
    if (result.srtPath) {
      console.log(`  SRT: ${result.srtPath}`);
    }
    if (result.vttPath) {
      console.log(`  VTT: ${result.vttPath}`);
    }
    if (result.duration) {
      console.log(`  Duration: ${result.duration.toFixed(2)}s`);
    }

    process.exit(0);
  } catch (error) {
    console.error(`\n[VideoCompose] ✗ Error:`, error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
