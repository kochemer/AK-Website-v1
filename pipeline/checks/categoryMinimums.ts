/**
 * Check: Category minimums
 * Warns if any category has < 3 articles
 */

import type { WeeklyDigest, Topic } from '../../lib/types';

const TOPIC_DISPLAY_NAMES: Record<Topic, string> = {
  'AI_and_Strategy': 'AI & Strategy',
  'Ecommerce_Retail_Tech': 'Ecommerce & Retail Tech',
  'Luxury_and_Consumer': 'Luxury & Consumer',
  'Jewellery_Industry': 'Jewellery Industry',
};

export function checkCategoryMinimums(digest: WeeklyDigest): string[] {
  const warnings: string[] = [];
  const MIN_ARTICLES = 3;

  const topics: Topic[] = [
    'AI_and_Strategy',
    'Ecommerce_Retail_Tech',
    'Luxury_and_Consumer',
    'Jewellery_Industry',
  ];

  for (const topic of topics) {
    const topicData = digest.topics[topic];
    const articleCount = topicData.top.length;

    if (articleCount < MIN_ARTICLES) {
      warnings.push(
        `${TOPIC_DISPLAY_NAMES[topic]}: ${articleCount} articles (minimum: ${MIN_ARTICLES})`
      );
    }
  }

  return warnings;
}
