/**
 * Weekly pipeline orchestrator
 * Runs the full weekly pipeline end-to-end and persists health report
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getCurrentDigestWeek, getCurrentIngestionWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';
import { discoverWeekly } from '../discovery/discoverWeekly';
import { classifyCurrentWeekArticles } from '../classification/classifyTopics';
import { buildAndSaveWeeklyDigest } from '../digest/buildWeeklyDigest';
import { runWeeklyChecks, type CheckResult } from './checks/runChecks';
import type { WeeklyDigest } from '../lib/types';

// Import email, podcast, cover functions (will create these)
import { buildWeeklyEmailDigest } from '../email/buildWeeklyEmailDigest';
import { buildWeeklyPodcast } from '../podcast/buildWeeklyPodcast';
import { regenerateCover } from '../digest/regenerateCover';

export type RunWeeklyPipelineOptions = {
  week?: string;               // digest week override
  ingestionWeek?: string;      // ingestion week override
  skipPodcast?: boolean;
  skipCover?: boolean;
  skipDiscovery?: boolean;
  skipClassification?: boolean;
  skipEmail?: boolean;
  skipDigest?: boolean;
};

export type PipelineStep = {
  name: string;
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  error?: string;
};

export type PipelineResult = {
  digestWeek: string;
  ingestionWeek: string;
  startedAt: string;
  finishedAt: string;
  steps: PipelineStep[];
  health: CheckResult;
  versions?: {
    node?: string;
    gitCommit?: string;
  };
};

/**
 * Get git commit hash (guarded, returns undefined if fails)
 */
function getGitCommit(): string | undefined {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Run a pipeline step with error handling
 */
async function runStep<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ ok: boolean; result?: T; error?: string; startedAt: string; finishedAt: string }> {
  const startedAt = new Date().toISOString();
  try {
    const result = await fn();
    const finishedAt = new Date().toISOString();
    return { ok: true, result, startedAt, finishedAt };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { ok: false, error: errorMessage, startedAt, finishedAt };
  }
}

/**
 * Load digest for health checks
 */
async function loadDigest(weekLabel: string): Promise<WeeklyDigest | null> {
  try {
    const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
    const raw = await fs.readFile(digestPath, 'utf-8');
    return JSON.parse(raw) as WeeklyDigest;
  } catch {
    return null;
  }
}

/**
 * Load podcast script text if available
 */
async function loadPodcastScript(weekLabel: string): Promise<string | undefined> {
  try {
    const scriptPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'podcast-script.txt');
    return await fs.readFile(scriptPath, 'utf-8');
  } catch {
    return undefined;
  }
}

/**
 * Run the full weekly pipeline
 */
export async function runWeeklyPipeline(options: RunWeeklyPipelineOptions = {}): Promise<PipelineResult> {
  const startedAt = new Date().toISOString();
  const steps: PipelineStep[] = [];

  // Determine weeks
  const digestWeek = options.week || getCurrentDigestWeek();
  const ingestionWeek = options.ingestionWeek || getCurrentIngestionWeek();
  
  validateWeekLabel(digestWeek);
  validateWeekLabel(ingestionWeek);

  console.log(`[Pipeline] Starting weekly pipeline`);
  console.log(`  Digest week: ${digestWeek}`);
  console.log(`  Ingestion week: ${ingestionWeek}`);
  console.log('');

  // Step 1: Discovery (ingestion week)
  if (!options.skipDiscovery) {
    const step = await runStep('discovery', async () => {
      console.log(`[Pipeline] Step 1/6: Discovery (${ingestionWeek})...`);
      return await discoverWeekly({ weekLabel: ingestionWeek });
    });
    steps.push({
      name: 'discovery',
      ok: step.ok,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      error: step.error,
    });
    if (!step.ok) {
      console.error(`[Pipeline] ✗ Discovery failed: ${step.error}`);
    } else {
      console.log(`[Pipeline] ✓ Discovery complete (added: ${step.result?.added || 0}, updated: ${step.result?.updated || 0})`);
    }
    console.log('');
  } else {
    console.log(`[Pipeline] Skipping discovery`);
  }

  // Step 2: Classification (digest week)
  if (!options.skipClassification) {
    const step = await runStep('classification', async () => {
      console.log(`[Pipeline] Step 2/6: Classification (${digestWeek})...`);
      const { DateTime } = await import('luxon');
      const weekMatch = digestWeek.match(/^(\d{4})-W(\d{1,2})$/);
      if (!weekMatch) {
        throw new Error(`Invalid week format: ${digestWeek}`);
      }
      const year = parseInt(weekMatch[1], 10);
      const weekNumber = parseInt(weekMatch[2], 10);
      const dt = DateTime.fromObject({ weekYear: year, weekNumber }, { zone: 'Europe/Copenhagen' });
      if (!dt.isValid) {
        throw new Error(`Invalid week: ${digestWeek}`);
      }
      return await classifyCurrentWeekArticles(dt.toJSDate());
    });
    steps.push({
      name: 'classification',
      ok: step.ok,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      error: step.error,
    });
    if (!step.ok) {
      console.error(`[Pipeline] ✗ Classification failed: ${step.error}`);
    } else {
      const byTopic = step.result?.byTopic;
      const total = byTopic ? Object.values(byTopic).reduce((sum, arr) => sum + arr.length, 0) : 0;
      console.log(`[Pipeline] ✓ Classification complete (total: ${total})`);
    }
    console.log('');
  } else {
    console.log(`[Pipeline] Skipping classification`);
  }

  // Step 3: Digest build (digest week)
  let digest: WeeklyDigest | null = null;
  if (!options.skipDigest) {
    const step = await runStep('digest', async () => {
      console.log(`[Pipeline] Step 3/6: Digest build (${digestWeek})...`);
      return await buildAndSaveWeeklyDigest(digestWeek);
    });
    steps.push({
      name: 'digest',
      ok: step.ok,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      error: step.error,
    });
    if (!step.ok) {
      console.error(`[Pipeline] ✗ Digest build failed: ${step.error}`);
    } else {
      digest = step.result || null;
      console.log(`[Pipeline] ✓ Digest build complete`);
    }
    console.log('');
  } else {
    console.log(`[Pipeline] Skipping digest build`);
    // Try to load existing digest for health checks
    digest = await loadDigest(digestWeek);
  }

  // Step 4: Email digest (digest week)
  if (!options.skipEmail) {
    const step = await runStep('email', async () => {
      console.log(`[Pipeline] Step 4/6: Email digest (${digestWeek})...`);
      return await buildWeeklyEmailDigest(digestWeek);
    });
    steps.push({
      name: 'email',
      ok: step.ok,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      error: step.error,
    });
    if (!step.ok) {
      console.error(`[Pipeline] ✗ Email digest failed: ${step.error}`);
    } else {
      console.log(`[Pipeline] ✓ Email digest complete`);
    }
    console.log('');
  } else {
    console.log(`[Pipeline] Skipping email digest`);
  }

  // Step 5: Podcast (digest week)
  if (!options.skipPodcast) {
    const step = await runStep('podcast', async () => {
      console.log(`[Pipeline] Step 5/6: Podcast (${digestWeek})...`);
      return await buildWeeklyPodcast(digestWeek);
    });
    steps.push({
      name: 'podcast',
      ok: step.ok,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      error: step.error,
    });
    if (!step.ok) {
      console.error(`[Pipeline] ✗ Podcast failed: ${step.error}`);
    } else {
      console.log(`[Pipeline] ✓ Podcast complete`);
    }
    console.log('');
  } else {
    console.log(`[Pipeline] Skipping podcast`);
  }

  // Step 6: Cover (digest week)
  if (!options.skipCover) {
    const step = await runStep('cover', async () => {
      console.log(`[Pipeline] Step 6/6: Cover (${digestWeek})...`);
      return await regenerateCover(digestWeek);
    });
    steps.push({
      name: 'cover',
      ok: step.ok,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      error: step.error,
    });
    if (!step.ok) {
      console.error(`[Pipeline] ✗ Cover failed: ${step.error}`);
    } else {
      console.log(`[Pipeline] ✓ Cover complete`);
    }
    console.log('');
  } else {
    console.log(`[Pipeline] Skipping cover`);
  }

  // Run health checks (if digest is available)
  let health: CheckResult = { warnings: [] };
  if (digest) {
    console.log(`[Pipeline] Running health checks...`);
    const allTopArticles = [
      ...digest.topics.AI_and_Strategy.top,
      ...digest.topics.Ecommerce_Retail_Tech.top,
      ...digest.topics.Luxury_and_Consumer.top,
      ...digest.topics.Jewellery_Industry.top,
    ];
    const podcastScriptText = await loadPodcastScript(digestWeek);
    health = runWeeklyChecks({
      digest,
      selectedArticles: allTopArticles,
      podcastScriptText,
    });
    console.log(`[Pipeline] Health checks complete (${health.warnings.length} warnings)`);
    console.log('');
  } else {
    console.log(`[Pipeline] Skipping health checks (no digest available)`);
    console.log('');
  }

  const finishedAt = new Date().toISOString();

  // Build result
  const result: PipelineResult = {
    digestWeek,
    ingestionWeek,
    startedAt,
    finishedAt,
    steps,
    health,
    versions: {
      node: process.version,
      gitCommit: getGitCommit(),
    },
  };

  // Save health report
  const healthReportPath = path.join(process.cwd(), 'data', 'weeks', digestWeek, 'health.json');
  await fs.mkdir(path.dirname(healthReportPath), { recursive: true });
  await fs.writeFile(healthReportPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`[Pipeline] ✓ Health report saved to: ${healthReportPath}`);

  // Print summary
  console.log('');
  console.log('=== Pipeline Summary ===');
  const failedSteps = steps.filter(s => !s.ok);
  if (failedSteps.length === 0) {
    console.log('All steps completed successfully ✅');
  } else {
    console.log(`✗ ${failedSteps.length} step(s) failed:`);
    failedSteps.forEach(step => {
      console.log(`  - ${step.name}: ${step.error}`);
    });
  }
  console.log(`Health warnings: ${health.warnings.length}`);
  if (health.warnings.length > 0) {
    console.log('Top warnings:');
    health.warnings.slice(0, 5).forEach(warn => {
      console.log(`  - ${warn}`);
    });
  }
  console.log('========================');
  console.log('');

  return result;
}
