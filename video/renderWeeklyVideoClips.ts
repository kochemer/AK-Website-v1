/**
 * Render Sora video clips from video plan
 * 
 * Handles caching, API calls, polling, and downloading of video assets.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import type { VideoPlan, VideoSegment } from './buildWeeklyVideoPlan';
import { probeSegment } from './videoSegmentReadiness';

// ── Types ──────────────────────────────────────────────────────────

export interface RenderConfig {
  weekLabel: string;
  model?: string;
  aspect?: 'portrait' | 'landscape';
  size?: string;
  concurrency?: number;
  dryRun?: boolean;
  maxSegments?: number;
  resumeFailed?: boolean;
}

export interface RenderOutput {
  segmentId: string;
  path: string;
  cacheKey: string;
  videoId?: string;
  status: 'cached' | 'rendered' | 'failed' | 'skipped_due_to_billing';
  originalPrompt?: string;
  sanitizedPrompt?: string;
}

export interface RenderResult {
  weekLabel: string;
  rendered: number;
  cached: number;
  failed: number;
  skippedDueToBilling: number;
  outputs: RenderOutput[];
}

interface VideoClipCacheEntry {
  cacheKey: string;
  model: string;
  size: string;
  seconds: number;
  promptHash: string;
  outputPath: string;
  createdAt: string;
}

type VideoClipCache = Record<string, VideoClipCacheEntry>;

interface OpenAIVideoResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  video_urls?: string[];
  error?: { message: string };
}

// ── Constants ──────────────────────────────────────────────────────

const ALLOWED_SIZES = ['720x1280', '1280x720', '1024x1792', '1792x1024'];
const ALLOWED_SECONDS = [4, 8, 12];
const DEFAULT_MODEL = 'sora-2';
const DEFAULT_CONCURRENCY = 2;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_TIME_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [2000, 6000]; // Exponential backoff: 2s, 6s

const CACHE_PATH = path.join(process.cwd(), 'data', 'cache', 'video-clips.json');

/**
 * Appended to every Sora prompt so the model includes audio in the output.
 * Sora has no API flag for audio; it must be requested in the prompt (see Sora 2 prompting guide).
 */
const SORA_AUDIO_CUE = ' Subtle ambient background audio.';

// ── Prompt sanitization ────────────────────────────────────────────────

/**
 * Risky words that trigger moderation - remove sentences containing these.
 */
const RISKY_WORDS = [
  'steal', 'hack', 'phish', 'spy', 'weapon', 'blood', 'violence', 'sexy', 'seduce',
  'illegal', 'drugs', 'kill', 'murder', 'attack', 'bomb', 'terror', 'hate',
  'minor', 'child', 'teen', 'underage', 'explicit', 'nude', 'porn',
];

/**
 * Brand replacements (specific -> generic).
 */
const BRAND_REPLACEMENTS: Record<string, string> = {
  'Pandora': 'luxury jewelry brand',
  'Tiffany': 'luxury jewelry brand',
  'Cartier': 'luxury jewelry brand',
};

/**
 * Sanitize prompt for moderation safety.
 */
function sanitizePrompt(original: string): string {
  let sanitized = original;

  // Remove sentences containing risky words
  const sentences = sanitized.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const safeSentences = sentences.filter(sentence => {
    const lower = sentence.toLowerCase();
    return !RISKY_WORDS.some(word => lower.includes(word));
  });
  sanitized = safeSentences.join('. ').trim();

  // Replace specific brands with generic terms
  for (const [brand, replacement] of Object.entries(BRAND_REPLACEMENTS)) {
    sanitized = sanitized.replace(new RegExp(brand, 'gi'), replacement);
  }

  // Remove mentions of age/minors
  sanitized = sanitized.replace(/\b\d+\s*(year|yr|age|old)\b/gi, '');
  sanitized = sanitized.replace(/\b(minor|child|teen|underage)\b/gi, '');

  // Remove political/hate content indicators
  sanitized = sanitized.replace(/\b(political|politics|election|vote|hate|racist)\b/gi, '');

  // Clean up multiple spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Force positive neutral framing
  if (sanitized.length > 0 && !sanitized.toLowerCase().includes('safe')) {
    sanitized += '. Safe, brand-friendly, professional tone.';
  }

  return sanitized;
}

/**
 * Check if error is a moderation/safety error.
 */
function isModerationError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('moderation') ||
    message.includes('safety') ||
    message.includes('content policy') ||
    message.includes('blocked')
  );
}

/**
 * Check if error is a billing hard limit error.
 */
function isBillingLimitError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('billing') &&
    (message.includes('hard limit') || message.includes('limit reached'))
  );
}

// ── Main function ───────────────────────────────────────────────────

/**
 * Render video clips from a video plan.
 */
export async function renderWeeklyVideoClips(cfg: RenderConfig): Promise<RenderResult> {
  const {
    weekLabel,
    model = DEFAULT_MODEL,
    aspect = 'portrait',
    size: sizeOverride,
    concurrency = DEFAULT_CONCURRENCY,
    dryRun = false,
    maxSegments,
    resumeFailed = false,
  } = cfg;

  // Load video plan
  const planPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'video', 'videoPlan.json');
  const planRaw = await fs.readFile(planPath, 'utf-8');
  const plan: VideoPlan = JSON.parse(planRaw);

  // Resume mode: load previous report and filter to failed segments only
  let failedSegmentIds: Set<string> | null = null;
  if (resumeFailed) {
    const reportPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'video', 'videoRender.json');
    try {
      const reportRaw = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(reportRaw) as { outputs?: RenderOutput[] };
      if (report.outputs) {
        failedSegmentIds = new Set(
          report.outputs
            .filter(o => o.status === 'failed' || o.status === 'skipped_due_to_billing')
            .map(o => o.segmentId)
        );
        console.log(`[VideoRender] Resume mode: ${failedSegmentIds.size} failed segments to retry`);
      }
    } catch {
      console.log(`[VideoRender] Resume mode: No previous report found, rendering all segments`);
    }
  }

  // Determine size
  const size = sizeOverride || (aspect === 'portrait' ? '720x1280' : '1280x720');
  if (!ALLOWED_SIZES.includes(size)) {
    throw new Error(`Invalid size: ${size}. Allowed: ${ALLOWED_SIZES.join(', ')}`);
  }

  // Filter segments if maxSegments specified
  let segments = plan.segments;
  if (maxSegments) {
    segments = segments.slice(0, maxSegments);
  }

  // Validate segment seconds
  for (const seg of segments) {
    if (!ALLOWED_SECONDS.includes(seg.seconds)) {
      throw new Error(
        `Invalid segment duration: ${seg.seconds}s for segment ${seg.id}. ` +
        `Allowed: ${ALLOWED_SECONDS.join(', ')}`
      );
    }
  }

  // Load cache
  const cache = await loadCache();

  // Prepare output directory
  const outputDir = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'video', 'raw');
  await fs.mkdir(outputDir, { recursive: true });

  // Check environment if not dry run
  if (!dryRun) {
    if (process.env.VIDEO_RENDER_ENABLED !== 'true') {
      throw new Error('VIDEO_RENDER_ENABLED must be set to "true" to render videos');
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY must be set to render videos');
    }
  }

  // Process segments with concurrency control
  const outputs: RenderOutput[] = [];
  let segmentsToProcess = segments.filter(seg => {
    // Only process segments that have prompts (intro has motionTitle, articles have bRoll, outro has ctaText)
    return seg.motionTitle || seg.bRoll || seg.ctaText;
  });

  // Resume mode: filter to failed segments only
  if (resumeFailed && failedSegmentIds) {
    segmentsToProcess = segmentsToProcess.filter(seg => failedSegmentIds!.has(seg.id));
  }

  // Process in batches with concurrency limit
  let billingLimitReached = false;
  for (let i = 0; i < segmentsToProcess.length; i += concurrency) {
    if (billingLimitReached) {
      // Mark remaining segments as skipped
      const remaining = segmentsToProcess.slice(i);
      for (const seg of remaining) {
        outputs.push({
          segmentId: seg.id,
          path: '',
          cacheKey: '',
          status: 'skipped_due_to_billing',
        });
      }
      break;
    }

    const batch = segmentsToProcess.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(seg => processSegment(seg, model, size, cache, outputDir, dryRun))
    );
    
    // Check for billing limit in batch results
    for (const result of batchResults) {
      if (result.status === 'skipped_due_to_billing') {
        billingLimitReached = true;
        console.log(`[VideoRender] Billing hard limit reached — aborting remaining segments`);
        break;
      }
    }
    
    outputs.push(...batchResults);
  }

  // Save updated cache
  await saveCache(cache);

  // Write render report
  const report = {
    weekLabel,
    generatedAt: new Date().toISOString(),
    config: { model, size, aspect, concurrency, dryRun, resumeFailed },
    stats: {
      total: segmentsToProcess.length,
      rendered: outputs.filter(o => o.status === 'rendered').length,
      cached: outputs.filter(o => o.status === 'cached').length,
      failed: outputs.filter(o => o.status === 'failed').length,
      skippedDueToBilling: outputs.filter(o => o.status === 'skipped_due_to_billing').length,
    },
    outputs,
  };

  const reportPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'video', 'videoRender.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  return {
    weekLabel,
    rendered: report.stats.rendered,
    cached: report.stats.cached,
    failed: report.stats.failed,
    skippedDueToBilling: report.stats.skippedDueToBilling,
    outputs,
  };
}

// ── Segment processing ──────────────────────────────────────────────

async function processSegment(
  segment: VideoSegment,
  model: string,
  size: string,
  cache: VideoClipCache,
  outputDir: string,
  dryRun: boolean
): Promise<RenderOutput> {
  // Determine prompt based on segment type
  let originalPrompt = '';
  if (segment.motionTitle) {
    originalPrompt = segment.motionTitle.concept;
  } else if (segment.bRoll) {
    originalPrompt = segment.bRoll.prompt;
  } else if (segment.ctaText) {
    originalPrompt = `Text overlay: ${segment.ctaText}, luxury intelligence website, elegant design`;
  } else {
    return {
      segmentId: segment.id,
      path: '',
      cacheKey: '',
      status: 'failed',
      originalPrompt: undefined,
      sanitizedPrompt: undefined,
    };
  }

  // Request audio in Sora output (no API flag; must be in prompt)
  originalPrompt = originalPrompt + SORA_AUDIO_CUE;

  // Generate cache key (always use original prompt for cache key)
  const cacheKey = createHash('sha256')
    .update(JSON.stringify({ model, size, seconds: segment.seconds, prompt: originalPrompt }))
    .digest('hex');

  // Check cache
  const cacheEntry = cache[cacheKey];
  if (cacheEntry) {
    try {
      await fs.access(cacheEntry.outputPath);
      // Copy cached file into this week's raw/ with correct segment filename.
      // Cache is global (same prompt can be reused across weeks) and multiple segments
      // can share the same prompt (e.g. seg-02 and seg-03 with identical b-roll) — we must
      // write segment.id.mp4 in outputDir so compose finds all 5 files.
      const destPath = path.join(outputDir, `${segment.id}.mp4`);
      if (cacheEntry.outputPath !== destPath) {
        await fs.copyFile(cacheEntry.outputPath, destPath);
        console.log(`[VideoRender] ${segment.id}: Copied cached clip to ${destPath}`);
      }
      return {
        segmentId: segment.id,
        path: destPath,
        cacheKey,
        status: 'cached',
        originalPrompt: undefined,
        sanitizedPrompt: undefined,
      };
    } catch {
      // File missing, remove from cache
      delete cache[cacheKey];
    }
  }

  if (dryRun) {
    console.log(`[VideoRender] ${segment.id}: Would render (dry run)`);
    return {
      segmentId: segment.id,
      path: path.join(outputDir, `${segment.id}.mp4`),
      cacheKey,
      status: 'rendered',
      originalPrompt: undefined,
      sanitizedPrompt: undefined,
    };
  }

  // Render with retries and moderation fallback
  let lastError: Error | null = null;
  let currentPrompt = originalPrompt;
  let sanitizedPrompt: string | undefined;
  let moderationErrorOccurred = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAYS_MS[attempt - 1];
        console.log(`[VideoRender] ${segment.id}: Retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
        await sleep(delay);
      }

      const videoId = await createVideoRequest(model, currentPrompt, segment.seconds, size);
      console.log(`[VideoRender] ${segment.id}: Created video request (${videoId})`);

      await pollVideoCompletion(videoId);
      console.log(`[VideoRender] ${segment.id}: Video completed, downloading content...`);

      const outputPath = path.join(outputDir, `${segment.id}.mp4`);
      await downloadVideoContent(videoId, outputPath);
      console.log(`[VideoRender] ${segment.id}: Saved to ${outputPath}`);

      // Verify segment is ready (size + ffprobe duration); if incomplete, treat as failure for resume
      const probe = await probeSegment(outputPath);
      if (probe.status !== 'ready') {
        console.error(`[VideoRender] ${segment.id}: INCOMPLETE after download — ${probe.reason ?? probe.status}`);
        throw new Error(`Segment incomplete: ${probe.reason ?? probe.status}`);
      }

      // Update cache (always use original prompt for cache key)
      cache[cacheKey] = {
        cacheKey,
        model,
        size,
        seconds: segment.seconds,
        promptHash: createHash('sha256').update(originalPrompt).digest('hex').substring(0, 16),
        outputPath,
        createdAt: new Date().toISOString(),
      };

      return {
        segmentId: segment.id,
        path: outputPath,
        cacheKey,
        videoId,
        status: 'rendered',
        originalPrompt: moderationErrorOccurred ? originalPrompt : undefined,
        sanitizedPrompt: moderationErrorOccurred ? sanitizedPrompt : undefined,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check for billing limit - fail fast
      if (isBillingLimitError(lastError)) {
        console.error(`[VideoRender] ${segment.id}: Billing hard limit reached — aborting`);
        return {
          segmentId: segment.id,
          path: '',
          cacheKey,
          status: 'skipped_due_to_billing',
          originalPrompt,
          sanitizedPrompt,
        };
      }

      // Check for moderation error - try sanitization once
      if (isModerationError(lastError) && !moderationErrorOccurred && attempt === 0) {
        console.log(`[VideoRender] ${segment.id}: Moderation error detected, sanitizing prompt...`);
        sanitizedPrompt = sanitizePrompt(originalPrompt);
        currentPrompt = sanitizedPrompt;
        moderationErrorOccurred = true;
        // Retry immediately with sanitized prompt (don't count as retry attempt)
        continue;
      }

      if (attempt < MAX_RETRIES) {
        continue; // Retry
      }
    }
  }

  // All retries failed
  console.error(`[VideoRender] ${segment.id}: Failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
  return {
    segmentId: segment.id,
    path: '',
    cacheKey,
    status: 'failed',
    originalPrompt: moderationErrorOccurred ? originalPrompt : undefined,
    sanitizedPrompt: moderationErrorOccurred ? sanitizedPrompt : undefined,
  };
}

// ── OpenAI API calls ────────────────────────────────────────────────

async function createVideoRequest(
  model: string,
  prompt: string,
  seconds: number,
  size: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  // Use FormData (available globally in Node.js 18+)
  // @ts-ignore - FormData is available in Node 18+
  const formData = new FormData();
  formData.append('model', model);
  formData.append('prompt', prompt);
  formData.append('seconds', seconds.toString());
  formData.append('size', size);

  const response = await fetch('https://api.openai.com/v1/videos', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as OpenAIVideoResponse;
  return data.id;
}

async function pollVideoCompletion(videoId: string): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    const response = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as OpenAIVideoResponse;

    if (data.status === 'completed') {
      return; // Video is ready, return void
    }

    if (data.status === 'failed') {
      const errorMsg = data.error?.message || 'Unknown error';
      throw new Error(`Video generation failed: ${errorMsg}`);
    }

    // Still processing, wait and retry
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Video polling timeout after ${MAX_POLL_TIME_MS}ms`);
}

/**
 * Download video content using the official content endpoint.
 */
async function downloadVideoContent(videoId: string, outputPath: string): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  console.log(`[VideoRender] Downloading content for ${videoId} -> ${outputPath}`);

  const response = await fetch(`https://api.openai.com/v1/videos/${videoId}/content`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download video content: ${response.status} ${response.statusText}`);
  }

  // Validate Content-Type
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('video') && !contentType.includes('application/octet-stream')) {
    console.warn(`[VideoRender] Unexpected Content-Type: ${contentType}`);
  }

  // Download as binary
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const bytes = buffer.length;

  // Validate size (> 50KB)
  const MIN_SIZE_BYTES = 50 * 1024; // 50KB
  if (bytes < MIN_SIZE_BYTES) {
    throw new Error(`Downloaded video is too small: ${bytes} bytes (minimum: ${MIN_SIZE_BYTES} bytes)`);
  }

  // Write to file
  await fs.writeFile(outputPath, buffer);
  console.log(`[VideoRender] Download complete (${bytes} bytes)`);
}

// ── Cache management ────────────────────────────────────────────────

async function loadCache(): Promise<VideoClipCache> {
  try {
    const content = await fs.readFile(CACHE_PATH, 'utf-8');
    return JSON.parse(content) as VideoClipCache;
  } catch {
    return {};
  }
}

async function saveCache(cache: VideoClipCache): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

// ── Utilities ───────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
