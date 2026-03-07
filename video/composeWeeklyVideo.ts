/**
 * Compose final weekly video from rendered segments
 * 
 * Concatenates segments, optionally adds voiceover audio, and handles subtitles.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { VideoPlan } from './buildWeeklyVideoPlan';
import { assertFfmpegInstalled } from '../lib/utils/ffmpeg';
import {
  probeSegment,
  EXPECTED_SEGMENT_IDS,
  type ProbeResult,
} from './videoSegmentReadiness';

export interface ComposeOptions {
  week: string;
  voiceoverPath?: string;
  subtitlesPath?: string;
  burnSubtitles?: boolean;
}

export interface ComposeResult {
  outputPath: string;
  srtPath?: string;
  vttPath?: string;
  duration?: number;
}

const MIN_FILE_SIZE = 100 * 1024; // 100KB

/**
 * Run ffmpeg command and stream logs.
 */
function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[VideoCompose] Running: ffmpeg ${args.join(' ')}`);
    
    const proc = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let hasError = false;
    let errorLines: string[] = [];

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        console.log(`[VideoCompose] ${line}`);
      }
    });

    proc.stderr.on('data', (data) => {
      // FFmpeg logs to stderr
      const lines = data.toString().split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        if (line.toLowerCase().includes('error')) {
          hasError = true;
          errorLines.push(line);
          console.error(`[VideoCompose] ${line}`);
        } else if (line.includes('Duration:') || line.includes('time=')) {
          // Progress info
          console.log(`[VideoCompose] ${line}`);
        }
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const errorMsg = hasError ? errorLines.join('; ') : `ffmpeg exited with code ${code}`;
        reject(new Error(errorMsg));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`ffmpeg spawn error: ${error.message}`));
    });
  });
}

/**
 * Get video duration using ffprobe.
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        if (isNaN(duration)) {
          reject(new Error('Could not parse video duration'));
        } else {
          resolve(duration);
        }
      } else {
        reject(new Error(`ffprobe exited with code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`ffprobe error: ${error.message}`));
    });
  });
}

/**
 * Convert SRT to VTT format.
 */
async function convertSRTtoVTT(srtPath: string, vttPath: string): Promise<void> {
  const srtContent = await fs.readFile(srtPath, 'utf-8');
  
  // Convert SRT to VTT
  // VTT format: WEBVTT header + replace comma with dot in timestamps
  const vttContent = 'WEBVTT\n\n' + srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  
  await fs.writeFile(vttPath, vttContent, 'utf-8');
  console.log(`[VideoCompose] Created VTT: ${vttPath}`);
}

/**
 * Compose final weekly video from rendered segments.
 */
export async function composeWeeklyVideo(opts: ComposeOptions): Promise<ComposeResult> {
  const { week, voiceoverPath, subtitlesPath, burnSubtitles = false } = opts;

  // Check ffmpeg
  await assertFfmpegInstalled();

  // Load video plan to get segment order
  const planPath = path.join(process.cwd(), 'data', 'weeks', week, 'video', 'videoPlan.json');
  const planRaw = await fs.readFile(planPath, 'utf-8');
  const plan: VideoPlan = JSON.parse(planRaw);

  const videoDir = path.join(process.cwd(), 'data', 'weeks', week, 'video');
  const rawDir = path.join(videoDir, 'raw');
  const finalDir = path.join(videoDir, 'final');
  await fs.mkdir(finalDir, { recursive: true });

  // Segment readiness: all 5 must be READY (size, ffprobe, duration in range)
  const segmentFiles: string[] = [];
  const notReady: { segId: string; result: ProbeResult }[] = [];

  for (const segId of EXPECTED_SEGMENT_IDS) {
    const segPath = path.join(rawDir, `${segId}.mp4`);
    const result = await probeSegment(segPath);
    if (result.status === 'ready') {
      segmentFiles.push(segPath);
    } else {
      notReady.push({ segId, result });
    }
  }

  if (notReady.length > 0) {
    const details = notReady
      .map(({ segId, result }) => `${segId}: ${result.status}${result.reason ? ` (${result.reason})` : ''}`)
      .join('; ');
    throw new Error(
      `Segment readiness check failed. All 5 segments must be READY before composing.\n` +
        `Not ready: ${details}\n` +
        `Run: npm run video:wait -- --week=${week}  (or ensure video:render completed successfully).`
    );
  }

  console.log(`[VideoCompose] All ${segmentFiles.length} segments READY`);

  // Step 1: Create concat.txt with deterministic order
  const concatPath = path.join(videoDir, 'concat.txt');
  const concatContent = segmentFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
  await fs.writeFile(concatPath, concatContent, 'utf-8');
  console.log(`[VideoCompose] Created concat list: ${concatPath}`);

  // Step 2: Concatenate segments
  const concatenatedPath = path.join(finalDir, `week-${week}-concat.mp4`);
  await runFFmpeg([
    '-f', 'concat',
    '-safe', '0',
    '-i', concatPath,
    '-c', 'copy',
    concatenatedPath,
  ]);

  // Validate concatenated file
  const concatStats = await fs.stat(concatenatedPath);
  if (concatStats.size < MIN_FILE_SIZE) {
    throw new Error(`Concatenated video is too small: ${concatStats.size} bytes`);
  }
  console.log(`[VideoCompose] Concatenated video: ${concatStats.size} bytes`);

  // Step 3: Build final video with optional audio and subtitles
  const outputPath = path.join(finalDir, `week-${week}.mp4`);
  const ffmpegArgs: string[] = ['-i', concatenatedPath];
  let inputCount = 1;

  // Add voiceover if provided
  if (voiceoverPath) {
    try {
      await fs.access(voiceoverPath);
      ffmpegArgs.push('-i', voiceoverPath);
      inputCount++;
      console.log(`[VideoCompose] Using voiceover: ${voiceoverPath}`);
    } catch {
      throw new Error(`Voiceover file not found: ${voiceoverPath}`);
    }
  }

  // Handle subtitles
  let srtPath: string | undefined;
  let vttPath: string | undefined;

  if (subtitlesPath) {
    try {
      await fs.access(subtitlesPath);
      srtPath = path.join(finalDir, `week-${week}.srt`);
      vttPath = path.join(finalDir, `week-${week}.vtt`);

      // Copy SRT to final directory
      await fs.copyFile(subtitlesPath, srtPath);
      console.log(`[VideoCompose] Copied SRT: ${srtPath}`);

      // Convert to VTT
      await convertSRTtoVTT(subtitlesPath, vttPath);

      if (!burnSubtitles) {
        // Mux subtitles as separate track
        ffmpegArgs.push('-i', subtitlesPath);
        inputCount++;
        console.log(`[VideoCompose] Muxing subtitles as separate track`);
      }
    } catch {
      throw new Error(`Subtitles file not found: ${subtitlesPath}`);
    }
  }

  // Build filter complex for video and audio
  const videoFilters: string[] = [];
  const mapArgs: string[] = [];

  // Video mapping
  mapArgs.push('-map', '0:v');

  // Audio handling
  if (voiceoverPath) {
    // Use voiceover audio, ignore original
    mapArgs.push('-map', `${inputCount - 1}:a`);
  } else {
    // Keep original audio
    mapArgs.push('-map', '0:a?');
  }

  // Subtitle handling
  if (subtitlesPath && burnSubtitles) {
    // Burn subtitles: use the already-copied SRT in finalDir to avoid path-with-spaces issues,
    // and escape colons for FFmpeg so "C:" is not parsed as filter option (original_size error on Windows).
    const srtForBurn = srtPath ?? path.join(finalDir, `week-${week}.srt`);
    const escapedPath = srtForBurn.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
    const subtitleFilter = `subtitles='${escapedPath}'`;
    videoFilters.push(subtitleFilter);
    console.log(`[VideoCompose] Burning subtitles into video`);
  } else if (subtitlesPath && !burnSubtitles) {
    // Mux subtitles as separate track
    const subtitleInputIdx = voiceoverPath ? 2 : 1;
    mapArgs.push('-map', `${subtitleInputIdx}:s?`);
    ffmpegArgs.push('-c:s', 'mov_text'); // MP4 subtitle codec
    console.log(`[VideoCompose] Muxing subtitles as separate track`);
  }

  // Apply video filters
  if (videoFilters.length > 0) {
    ffmpegArgs.push('-vf', videoFilters.join(';'));
  }

  // Add mapping arguments
  ffmpegArgs.push(...mapArgs);

  // Video/audio codecs
  ffmpegArgs.push('-c:v', 'libx264');
  if (voiceoverPath) {
    ffmpegArgs.push('-c:a', 'aac'); // Re-encode with AAC for voiceover mix
  } else {
    ffmpegArgs.push('-c:a', 'copy'); // Keep original audio codec if no voiceover
  }

  // Use shortest duration if mixing audio
  if (voiceoverPath) {
    ffmpegArgs.push('-shortest');
  }

  // Output
  ffmpegArgs.push('-y', outputPath); // -y to overwrite

  await runFFmpeg(ffmpegArgs);

  // Validate output
  const outputStats = await fs.stat(outputPath);
  if (outputStats.size < MIN_FILE_SIZE) {
    throw new Error(`Final video is too small: ${outputStats.size} bytes`);
  }

  // Get duration
  let duration: number | undefined;
  try {
    duration = await getVideoDuration(outputPath);
    console.log(`[VideoCompose] Video duration: ${duration.toFixed(2)}s`);
  } catch (error) {
    console.warn(`[VideoCompose] Could not determine duration: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log(`[VideoCompose] Created final video: ${outputPath} (${outputStats.size} bytes)`);

  return {
    outputPath,
    srtPath,
    vttPath,
    duration,
  };
}
