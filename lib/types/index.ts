/**
 * Centralized type exports for the application.
 * 
 * Usage:
 *   import { Article, WeeklyDigest, Topic } from '@/lib/types';
 * 
 * This module re-exports all canonical types from:
 * - article.ts: Article, RelevanceScore, ArticleWithRelevance
 * - digest.ts: WeeklyDigest, Topic, DigestTopic, EmailDigest, etc.
 */

// Article types
export type {
  Article,
  ArticleWithRelevance,
  RelevanceScore,
  ArticleSourceType,
  CategoryHint,
  DateSource,
  DateSourceDetail,
  DateConfidence,
} from './article';

// Digest types
export type {
  WeeklyDigest,
  WeeklyDigestWithRelevance,
  Topic,
  TopicTotalsKey,
  DigestTopic,
  DigestTopics,
  DigestTotals,
  EmailDigest,
  EmailDigestItem,
} from './digest';

// Constants
export { TOPIC_TO_TOTALS_KEY } from './digest';
