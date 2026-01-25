/**
 * Test script for podcast audio mixing
 * Generates a short 1-minute segment with ElevenLabs voice and music mixing
 */

import { promises as fs, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';

const execAsync = promisify(exec);

// --- Environment Variable Loading for CLI ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
  // Ignore if .env.local doesn't exist
}

// Check for ElevenLabs credentials
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

if (!ELEVENLABS_API_KEY) {
  console.error('Error: ELEVENLABS_API_KEY is not set in environment variables. Please add it to .env.local');
  process.exit(1);
}

if (!ELEVENLABS_VOICE_ID) {
  console.error('Error: ELEVENLABS_VOICE_ID is not set in environment variables. Please add it to .env.local');
  process.exit(1);
}

/**
 * Resolve FFmpeg executable path
 */
function resolveFfmpegPath(): string | null {
  const isWindows = platform() === 'win32';
  const exe = isWindows ? '.exe' : '';
  
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }
  
  const bundledPath = path.join(__dirname, '../tools/ffmpeg', `ffmpeg${exe}`);
  try {
    if (require('fs').existsSync(bundledPath)) {
      return bundledPath;
    }
  } catch {
    // Continue to next option
  }
  
  return 'ffmpeg';
}

/**
 * Resolve FFprobe executable path
 */
function resolveFfprobePath(): string | null {
  const isWindows = platform() === 'win32';
  const exe = isWindows ? '.exe' : '';
  
  if (process.env.FFPROBE_PATH) {
    return process.env.FFPROBE_PATH;
  }
  
  if (process.env.FFMPEG_PATH) {
    const ffmpegPath = process.env.FFMPEG_PATH;
    const ffprobePath = ffmpegPath.replace(/ffmpeg/i, 'ffprobe');
    try {
      if (require('fs').existsSync(ffprobePath)) {
        return ffprobePath;
      }
    } catch {
      // Continue to next option
    }
  }
  
  const bundledPath = path.join(__dirname, '../tools/ffmpeg', `ffprobe${exe}`);
  try {
    if (require('fs').existsSync(bundledPath)) {
      return bundledPath;
    }
  } catch {
    // Continue to next option
  }
  
  return 'ffprobe';
}

/**
 * Mix music with voice audio using FFmpeg
 */
async function mixMusicWithVoice(
  voicePath: string,
  musicPath: string,
  outputPath: string,
  fadeIn: number = 1.2,
  fadeOut: number = 1.8,
  musicVolume: number = 0.12
): Promise<void> {
  const ffmpegPath = resolveFfmpegPath();
  const ffprobePath = resolveFfprobePath();
  
  if (!ffmpegPath || !ffprobePath) {
    throw new Error('FFmpeg not found. Please install FFmpeg or place it in tools/ffmpeg/');
  }
  
  // Get voice duration first
  let duration: number;
  try {
    const { stdout: durationStr } = await execAsync(`"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${voicePath}"`);
    duration = parseFloat(durationStr.trim());
  } catch (error: any) {
    throw new Error(`Failed to get voice duration: ${error.message}`);
  }
  
  const fadeOutStart = Math.max(0, duration - fadeOut);
  
  // FFmpeg command to mix music with voice (fixed version)
  const command = `"${ffmpegPath}" -i "${voicePath}" -stream_loop -1 -i "${musicPath}" -filter_complex "[1:a]volume=${musicVolume}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[amix];[amix]afade=t=in:ss=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeOut}[out]" -map "[out]" -c:a libmp3lame -b:a 192k -shortest "${outputPath}"`;
  
  console.log(`[FFmpeg] Mixing music with voice...`);
  console.log(`  Voice: ${voicePath}`);
  console.log(`  Music: ${musicPath}`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  Duration: ${duration.toFixed(2)}s`);
  
  try {
    await execAsync(command);
    console.log(`✓ Music mixing successful!`);
  } catch (error: any) {
    throw new Error(`FFmpeg mixing failed: ${error.message}`);
  }
}

/**
 * Generate speech using ElevenLabs
 */
async function generateSpeech(text: string, outputPath: string): Promise<void> {
  const { generateSpeech } = await import('../podcast/tts/elevenlabs');
  
  console.log(`[ElevenLabs] Generating speech...`);
  console.log(`  Voice ID: ${ELEVENLABS_VOICE_ID}`);
  console.log(`  Text length: ${text.length} characters`);
  
  await generateSpeech({
    text: text,
    voiceId: ELEVENLABS_VOICE_ID!,
    outputPath: outputPath,
    model: 'eleven_multilingual_v2',
    stability: 0.4,
    similarityBoost: 0.8,
    style: 0.4,
    useSpeakerBoost: true,
  });
  
  console.log(`✓ Speech generated!`);
}

async function main() {
  console.log('=== Podcast Mix Test ===\n');
  
  // Create test output directory
  const testDir = path.join(__dirname, '../test-output');
  await fs.mkdir(testDir, { recursive: true });
  
  // Generate a short 1-minute test script (~150 words)
  const testScript = `Welcome to this test podcast segment. We're testing the audio mixing capabilities with ElevenLabs voice synthesis and background music. This is a short one-minute segment designed to verify that the music mixing works correctly with the voice audio. The background music should be subtle, at about twelve percent volume, with smooth fade in and fade out effects. This test will help us ensure that the podcast generation pipeline works as expected for full weekly episodes.`;
  
  const voicePath = path.join(testDir, 'test-voice.mp3');
  const musicPath = path.join(__dirname, '../assets/audio/podcast-theme.mp3.mp3');
  const outputPath = path.join(testDir, 'test-podcast-mixed.mp3');
  
  // Step 1: Generate voice audio
  console.log('\n[Step 1] Generating voice audio with ElevenLabs...\n');
  await generateSpeech(testScript, voicePath);
  
  // Step 2: Check if music file exists
  try {
    await fs.access(musicPath);
  } catch {
    console.error(`\nError: Music file not found at ${musicPath}`);
    console.log(`\nVoice-only audio saved to: ${voicePath}`);
    process.exit(1);
  }
  
  // Step 3: Mix music with voice
  console.log('\n[Step 2] Mixing music with voice...\n');
  await mixMusicWithVoice(voicePath, musicPath, outputPath);
  
  // Step 4: Get final file stats
  const stats = await fs.stat(outputPath);
  const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
  
  // Get duration
  const ffprobePath = resolveFfprobePath();
  let duration: number | null = null;
  if (ffprobePath) {
    try {
      const { stdout: durationStr } = await execAsync(`"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`);
      duration = parseFloat(durationStr.trim());
    } catch {
      // Ignore
    }
  }
  
  console.log('\n=== Test Complete ===');
  console.log(`✓ Output file: ${outputPath}`);
  console.log(`  Size: ${fileSizeMB} MB`);
  if (duration) {
    console.log(`  Duration: ${Math.round(duration)}s (~${Math.round(duration / 60)}min)`);
  }
  console.log(`\nTest files saved to: ${testDir}`);
  console.log(`  - Voice only: test-voice.mp3`);
  console.log(`  - Mixed: test-podcast-mixed.mp3`);
}

main().catch((error) => {
  console.error('\nError:', error.message);
  process.exit(1);
});
