/**
 * Build SRT captions for weekly video
 * 
 * Generates captions.srt from video plan segments.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { VideoPlan } from './buildWeeklyVideoPlan';

/**
 * Format seconds to SRT timestamp (HH:MM:SS,mmm).
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

/**
 * Build SRT captions file from video plan.
 */
export async function buildWeeklyVideoCaptions({
  weekLabel,
}: {
  weekLabel: string;
}): Promise<string> {
  // Load video plan
  const planPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'video', 'videoPlan.json');
  const planRaw = await fs.readFile(planPath, 'utf-8');
  const plan: VideoPlan = JSON.parse(planRaw);

  // Generate SRT blocks
  const srtBlocks: string[] = [];
  let currentTime = 0;
  let blockIndex = 1;

  for (const seg of plan.segments) {
    // Only create caption blocks for segments with voText
    if (seg.voText && seg.voText.trim().length > 0) {
      const startTime = formatSRTTime(currentTime);
      const endTime = formatSRTTime(currentTime + seg.seconds);
      
      srtBlocks.push(
        `${blockIndex}`,
        `${startTime} --> ${endTime}`,
        seg.voText.trim(),
        '' // Blank line between blocks
      );
      
      blockIndex++;
    }
    
    // Accumulate time
    currentTime += seg.seconds;
  }

  // Write SRT file
  const captionsPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'video', 'captions.srt');
  const srtContent = srtBlocks.join('\n');
  await fs.writeFile(captionsPath, srtContent, 'utf-8');
  
  console.log(`[VideoCaptions] Created captions: ${captionsPath} (${blockIndex - 1} blocks)`);
  
  return captionsPath;
}
