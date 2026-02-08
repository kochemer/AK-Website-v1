/**
 * Run all weekly health checks and aggregate results
 */

import type { WeeklyDigest, Article } from '../../lib/types';
import { checkPaywallPercent } from './paywallPercent';
import { checkCategoryMinimums } from './categoryMinimums';
import { checkPodcastDuration } from './podcastDuration';
import { checkDomainConcentration } from './domainConcentration';

export interface CheckResult {
  warnings: string[];
  metrics?: {
    paywallPercent?: number;
    podcastWordCount?: number;
  };
}

export function runWeeklyChecks(options: {
  digest: WeeklyDigest;
  selectedArticles: Article[];
  podcastScriptText?: string;
}): CheckResult {
  const { digest, selectedArticles, podcastScriptText } = options;
  const warnings: string[] = [];
  const metrics: CheckResult['metrics'] = {};

  // Collect all top articles from digest
  const allTopArticles = [
    ...digest.topics.AI_and_Strategy.top,
    ...digest.topics.Ecommerce_Retail_Tech.top,
    ...digest.topics.Luxury_and_Consumer.top,
    ...digest.topics.Jewellery_Industry.top,
  ];

  // Run checks
  warnings.push(...checkPaywallPercent(allTopArticles));
  warnings.push(...checkCategoryMinimums(digest));
  warnings.push(...checkPodcastDuration(podcastScriptText));
  warnings.push(...checkDomainConcentration(digest));

  // Collect metrics
  if (allTopArticles.length > 0) {
    const paywalledCount = allTopArticles.filter(a => a.paywalled === true).length;
    metrics.paywallPercent = (paywalledCount / allTopArticles.length) * 100;
  }

  if (podcastScriptText) {
    const words = podcastScriptText.trim().split(/\s+/).filter(w => w.length > 0).length;
    metrics.podcastWordCount = words;
  }

  return { warnings, metrics };
}

/**
 * Print health check results to console
 */
export function printHealthCheckResults(result: CheckResult): void {
  console.log('\n=== Weekly Health Checks ===');
  
  if (result.warnings.length === 0) {
    console.log('All checks passed ✅');
  } else {
    for (const warning of result.warnings) {
      console.log(`WARN: ${warning}`);
    }
  }

  // Optionally print metrics if available
  if (result.metrics && Object.keys(result.metrics).length > 0) {
    if (result.metrics.paywallPercent !== undefined) {
      console.log(`Metrics: Paywall share: ${result.metrics.paywallPercent.toFixed(1)}%`);
    }
    if (result.metrics.podcastWordCount !== undefined) {
      console.log(`Metrics: Podcast words: ${result.metrics.podcastWordCount}`);
    }
  }
}
