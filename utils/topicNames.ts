/**
 * Single source of truth for topic display names.
 * Maps topic keys (used in digest structure) to their display labels.
 */

export type TopicKey = 
  | 'AI_and_Strategy'
  | 'Ecommerce_Retail_Tech'
  | 'Luxury_and_Consumer'
  | 'Jewellery_Industry';

export type TopicTotalsKey = 
  | 'AIStrategy'
  | 'EcommerceRetail'
  | 'LuxuryConsumer'
  | 'Jewellery';

/**
 * Mapping from topic keys (used in digest.topics) to display names
 */
export const TOPIC_DISPLAY_NAMES: Record<TopicKey, string> = {
  AI_and_Strategy: 'AI & Strategy',
  Ecommerce_Retail_Tech: 'Ecommerce & Retail Tech',
  Luxury_and_Consumer: 'Luxury & Consumer',
  Jewellery_Industry: 'Jewellery Industry',
};

/**
 * Mapping from totals keys (used in digest.totals.byTopic) to display names
 */
export const TOPIC_TOTALS_DISPLAY_NAMES: Record<TopicTotalsKey, string> = {
  AIStrategy: 'AI & Strategy',
  EcommerceRetail: 'Ecommerce & Retail Tech',
  LuxuryConsumer: 'Luxury & Consumer',
  Jewellery: 'Jewellery Industry',
};

/**
 * Get display name for a topic key
 */
export function getTopicDisplayName(key: TopicKey): string {
  return TOPIC_DISPLAY_NAMES[key];
}

/**
 * Get display name for a totals key
 */
export function getTopicTotalsDisplayName(key: TopicTotalsKey): string {
  return TOPIC_TOTALS_DISPLAY_NAMES[key];
}


