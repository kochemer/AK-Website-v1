/**
 * Wait for all weekly video segment renders to be READY (poll raw/ until all 5 pass probeSegment).
 */

import path from 'path';
import { assertFfmpegInstalled } from '../lib/utils/ffmpeg';
import {
  probeSegment,
  EXPECTED_SEGMENT_IDS,
  type ProbeResult,
} from './videoSegmentReadiness';

export interface WaitConfig {
  week: string;
  timeoutMin?: number;
  pollSec?: number;
}

export interface SegmentReadinessRow {
  segmentId: string;
  path: string;
  result: ProbeResult;
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '—';
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)}MB`;
}

function formatDuration(sec?: number): string {
  if (sec === undefined) return '—';
  return `${sec.toFixed(1)}s`;
}

/**
 * Poll raw/ once and return readiness for all 5 segments.
 */
async function pollSegmentReadiness(rawDir: string): Promise<SegmentReadinessRow[]> {
  const rows: SegmentReadinessRow[] = [];
  for (const segId of EXPECTED_SEGMENT_IDS) {
    const segPath = path.join(rawDir, `${segId}.mp4`);
    const result = await probeSegment(segPath);
    rows.push({ segmentId: segId, path: segPath, result });
  }
  return rows;
}

/**
 * Print a compact table of segment status.
 */
function printTable(rows: SegmentReadinessRow[]): void {
  for (const { segmentId, result } of rows) {
    const status = result.status.toUpperCase();
    const sizeStr = formatSize(result.sizeBytes);
    const durStr = result.durationSec !== undefined
      ? formatDuration(result.durationSec)
      : (result.reason ?? '—');
    const extra = result.status === 'ready'
      ? `(${sizeStr}, ${durStr})`
      : result.status === 'incomplete'
        ? `(${sizeStr}, ${result.reason ?? 'ffprobe failed'})`
        : `(${result.reason ?? 'missing'})`;
    console.log(`  ${segmentId} ${status} ${extra}`);
  }
}

/**
 * Wait until all 5 segments are READY or timeout.
 * On each poll prints a compact table.
 * Returns true if all ready within timeout; false otherwise.
 */
export async function waitForWeeklyVideoRenders(cfg: WaitConfig): Promise<{
  ready: boolean;
  finalRows: SegmentReadinessRow[];
  reason?: string;
}> {
  const { week, timeoutMin = 60, pollSec = 20 } = cfg;
  await assertFfmpegInstalled();

  const rawDir = path.join(process.cwd(), 'data', 'weeks', week, 'video', 'raw');
  const deadline = Date.now() + timeoutMin * 60 * 1000;
  let pollCount = 0;

  while (Date.now() < deadline) {
    pollCount++;
    const rows = await pollSegmentReadiness(rawDir);
    const allReady = rows.every((r) => r.result.status === 'ready');

    console.log(`[VideoWait] Poll #${pollCount} (${new Date().toISOString()})`);
    printTable(rows);

    if (allReady) {
      console.log(`[VideoWait] ✓ All segments READY`);
      return { ready: true, finalRows: rows };
    }

    const notReady = rows.filter((r) => r.result.status !== 'ready');
    if (Date.now() + pollSec * 1000 > deadline) {
      console.log(`[VideoWait] ✗ Timeout (${timeoutMin} min). Not ready: ${notReady.map((r) => r.segmentId).join(', ')}`);
      for (const r of notReady) {
        console.log(`  ${r.segmentId}: ${r.result.reason ?? r.result.status}`);
      }
      return {
        ready: false,
        finalRows: rows,
        reason: `Timeout; not ready: ${notReady.map((r) => `${r.segmentId} (${r.result.reason})`).join('; ')}`,
      };
    }

    console.log(`[VideoWait] Next poll in ${pollSec}s...\n`);
    await new Promise((r) => setTimeout(r, pollSec * 1000));
  }

  const rows = await pollSegmentReadiness(rawDir);
  const notReady = rows.filter((r) => r.result.status !== 'ready');
  const reason = `Timeout after ${timeoutMin} min; not ready: ${notReady.map((r) => r.segmentId).join(', ')}`;
  console.log(`[VideoWait] ✗ ${reason}`);
  return { ready: false, finalRows: rows, reason };
}
