/**
 * Segment readiness checks for weekly video composition.
 * Uses ffprobe (ships with ffmpeg); rely on assertFfmpegInstalled() before use.
 */

import { promises as fs } from 'fs';
import { spawn } from 'child_process';

export type SegmentStatus = 'missing' | 'incomplete' | 'ready';

const MIN_SIZE_BYTES = 1_000_000; // 1MB
const DURATION_MIN_SEC = 4;  // intro can be 4s
const DURATION_MAX_SEC = 20;

export interface ProbeResult {
  status: SegmentStatus;
  sizeBytes?: number;
  durationSec?: number;
  reason?: string;
}

/**
 * Get video duration via ffprobe.
 */
function getDuration(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      path,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let output = '';
    proc.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        if (isNaN(duration)) {
          reject(new Error('Could not parse duration'));
        } else {
          resolve(duration);
        }
      } else {
        reject(new Error(`ffprobe exited ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Probe a segment file for readiness.
 * - missing: file not found
 * - incomplete: size < 1MB OR ffprobe fails OR duration not in [4, 20]s
 * - ready: passes all checks
 */
export async function probeSegment(path: string): Promise<ProbeResult> {
  let stat: { size: number };
  try {
    stat = await fs.stat(path);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      return { status: 'missing', reason: 'file not found' };
    }
    return { status: 'incomplete', reason: String(err) };
  }

  const sizeBytes = stat.size;
  if (sizeBytes < MIN_SIZE_BYTES) {
    return {
      status: 'incomplete',
      sizeBytes,
      reason: `size ${(sizeBytes / 1024 / 1024).toFixed(2)}MB < ${MIN_SIZE_BYTES / 1024 / 1024}MB`,
    };
  }

  let durationSec: number;
  try {
    durationSec = await getDuration(path);
  } catch (err) {
    return {
      status: 'incomplete',
      sizeBytes,
      reason: `ffprobe failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (durationSec < DURATION_MIN_SEC || durationSec > DURATION_MAX_SEC) {
    return {
      status: 'incomplete',
      sizeBytes,
      durationSec,
      reason: `duration ${durationSec.toFixed(1)}s not in [${DURATION_MIN_SEC}, ${DURATION_MAX_SEC}]`,
    };
  }

  return { status: 'ready', sizeBytes, durationSec };
}

/** Expected segment IDs for weekly video (order matters). */
export const EXPECTED_SEGMENT_IDS = ['seg-01', 'seg-02', 'seg-03', 'seg-04', 'seg-outro'] as const;
