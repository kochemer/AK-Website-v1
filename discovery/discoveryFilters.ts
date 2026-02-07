import type { Topic } from '../classification/classifyTopics';

export type DiscoveryFilterConfig = {
  domainPatterns: RegExp[];
  urlPatterns: RegExp[];
};

const DEFAULT_FILTERS: Record<Topic, DiscoveryFilterConfig> = {
  AI_and_Strategy: {
    domainPatterns: [
      /jobs?\./i,
      /careers?\./i
    ],
    urlPatterns: [
      /\/careers?\b/i,
      /\/jobs?\b/i,
      /\/vacancies\b/i,
      /\/apply\b/i,
      /\/directory\b/i,
      /\/apps?\//i,
      /\/app\//i
    ]
  },
  Ecommerce_Retail_Tech: {
    domainPatterns: [
      /jobs?\./i,
      /careers?\./i
    ],
    urlPatterns: [
      /\/careers?\b/i,
      /\/jobs?\b/i,
      /\/vacancies\b/i,
      /\/apply\b/i,
      /\/directory\b/i,
      /\/apps?\//i,
      /\/app\//i
    ]
  },
  Luxury_and_Consumer: {
    domainPatterns: [
      /jobs?\./i,
      /careers?\./i
    ],
    urlPatterns: [
      /\/careers?\b/i,
      /\/jobs?\b/i,
      /\/vacancies\b/i,
      /\/apply\b/i,
      /\/directory\b/i,
      /\/apps?\//i,
      /\/app\//i
    ]
  },
  Jewellery_Industry: {
    domainPatterns: [
      /jobs?\./i,
      /careers?\./i
    ],
    urlPatterns: [
      /\/careers?\b/i,
      /\/jobs?\b/i,
      /\/vacancies\b/i,
      /\/apply\b/i,
      /\/directory\b/i,
      /\/apps?\//i,
      /\/app\//i
    ]
  }
};

function parseExtraExcludeRegexes(raw?: string): RegExp[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => new RegExp(item, 'i'));
}

export function getDiscoveryFilters(topic: Topic): DiscoveryFilterConfig {
  const base = DEFAULT_FILTERS[topic];
  const extra = parseExtraExcludeRegexes(process.env.DISCOVERY_EXTRA_EXCLUDES);
  return {
    domainPatterns: [...base.domainPatterns, ...extra],
    urlPatterns: [...base.urlPatterns, ...extra]
  };
}
