/**
 * Build voiceover for weekly video
 *
 * Generates voiceover text file (voiceover.txt). ElevenLabs TTS is disabled for now —
 * no vo.wav is created; re-enable by uncommenting the block below and adding back
 * the convertMp3ToWav helper + imports (textToSpeech, assertFfmpegInstalled).
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { VideoPlan } from './buildWeeklyVideoPlan';

export interface VoiceoverResult {
  voiceoverTextPath: string;
  voiceoverWavPath: string;
}

/**
 * Build voiceover text for weekly video. Audio (vo.wav) is not generated — disabled for now.
 */
export async function buildWeeklyVideoVoiceover({
  weekLabel,
  dryRun = false,
}: {
  weekLabel: string;
  dryRun?: boolean;
}): Promise<VoiceoverResult> {
  // Load video plan
  const planPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'video', 'videoPlan.json');
  const planRaw = await fs.readFile(planPath, 'utf-8');
  const plan: VideoPlan = JSON.parse(planRaw);

  // Extract voText from segments (article segments only in practice)
  const voTexts: string[] = [];
  for (const seg of plan.segments) {
    if (seg.voText && seg.voText.trim().length > 0) {
      voTexts.push(seg.voText.trim());
    }
  }

  const videoDir = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'video');
  await fs.mkdir(videoDir, { recursive: true });

  // Create voiceover text file
  const voiceoverTextPath = path.join(videoDir, 'voiceover.txt');
  const voiceoverText = voTexts.join('\n\n');
  await fs.writeFile(voiceoverTextPath, voiceoverText, 'utf-8');
  console.log(`[VideoVoiceover] Created voiceover text: ${voiceoverTextPath}`);

  const voiceoverWavPath = path.join(videoDir, 'vo.wav');

  if (dryRun) {
    console.log(`[VideoVoiceover] DRY RUN - Would generate audio at: ${voiceoverWavPath}`);
    return { voiceoverTextPath, voiceoverWavPath };
  }

  // ElevenLabs TTS disabled for now — only voiceover.txt is created
  console.log(`[VideoVoiceover] Voiceover audio disabled (ElevenLabs off). Only voiceover.txt created.`);
  return { voiceoverTextPath, voiceoverWavPath };

  /* Re-enable ElevenLabs when needed:
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    console.log(
      `[VideoVoiceover] ELEVENLABS_API_KEY not set — skipping audio. ` +
      `Set it to generate vo.wav (see https://elevenlabs.io).`
    );
    return { voiceoverTextPath, voiceoverWavPath };
  }

  if (voiceoverText.length === 0) {
    console.log(`[VideoVoiceover] No voText in plan — skipping TTS`);
    return { voiceoverTextPath, voiceoverWavPath };
  }

  await assertFfmpegInstalled();
  console.log(`[VideoVoiceover] Generating speech via ElevenLabs (${voiceoverText.length} chars)...`);
  const audioBuffer = await textToSpeech(voiceoverText);
  const mp3Path = path.join(videoDir, 'vo.mp3');
  await fs.writeFile(mp3Path, audioBuffer);
  console.log(`[VideoVoiceover] Saved MP3: ${mp3Path}`);
  await convertMp3ToWav(mp3Path, voiceoverWavPath);
  await fs.unlink(mp3Path).catch(() => {});
  console.log(`[VideoVoiceover] Created voiceover audio: ${voiceoverWavPath}`);
  */
}
