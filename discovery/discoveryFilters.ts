import type { Topic } from '../classification/classifyTopics';

export type DiscoveryFilterConfig = {
  domainPatterns: RegExp[];
  urlPatterns: RegExp[];
};

/**
 * Domain-name patterns that indicate a job/recruitment site.
 * Shared across all topics and also consumed by `searchProvider.ts` for hard
 * exclusions before results even reach the per-topic filter stage.
 */
export const SHARED_EXCLUDE_DOMAIN_PATTERNS: RegExp[] = [
  /jobs?\./i,
  /careers?\./i,
];

/**
 * URL path patterns that indicate job listings, app stores, or directory
 * pages — content unlikely to be editorial news.
 * Shared across all topics; `searchProvider.ts` also imports these for its
 * hard-exclude path check.
 */
export const SHARED_EXCLUDE_URL_PATTERNS: RegExp[] = [
  /\/careers?\b/i,
  /\/jobs?\b/i,
  /\/vacancies\b/i,
  /\/apply\b/i,
  /\/directory\b/i,
  /\/apps?\//i,
  /\/app\//i,
];

/**
 * Per-topic filter configs. All topics currently share the same base patterns;
 * topic-specific overrides can be added here as needed.
 */
const DEFAULT_FILTERS: Record<Topic, DiscoveryFilterConfig> = {
  AI_and_Strategy:     { domainPatterns: SHARED_EXCLUDE_DOMAIN_PATTERNS, urlPatterns: SHARED_EXCLUDE_URL_PATTERNS },
  Ecommerce_Retail_Tech: { domainPatterns: SHARED_EXCLUDE_DOMAIN_PATTERNS, urlPatterns: SHARED_EXCLUDE_URL_PATTERNS },
  Luxury_and_Consumer: { domainPatterns: SHARED_EXCLUDE_DOMAIN_PATTERNS, urlPatterns: SHARED_EXCLUDE_URL_PATTERNS },
  Jewellery_Industry:  { domainPatterns: SHARED_EXCLUDE_DOMAIN_PATTERNS, urlPatterns: SHARED_EXCLUDE_URL_PATTERNS },
};

/**
 * Parses the `DISCOVERY_EXTRA_EXCLUDES` env var into RegExp objects.
 * Format: comma-separated regex strings, e.g. `"example\\.com,/promo/"`.
 */
function parseExtraExcludeRegexes(raw?: string): RegExp[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => new RegExp(item, 'i'));
}

/**
 * Returns the combined domain + URL filter config for a given topic,
 * including any extra patterns supplied via `DISCOVERY_EXTRA_EXCLUDES`.
 */
export function getDiscoveryFilters(topic: Topic): DiscoveryFilterConfig {
  const base  = DEFAULT_FILTERS[topic];
  const extra = parseExtraExcludeRegexes(process.env.DISCOVERY_EXTRA_EXCLUDES);
  return {
    domainPatterns: [...base.domainPatterns, ...extra],
    urlPatterns:    [...base.urlPatterns,    ...extra],
  };
}
