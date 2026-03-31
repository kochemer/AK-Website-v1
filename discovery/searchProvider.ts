import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import type { Topic } from '../classification/classifyTopics';
import { CONSULTANCY_DOMAINS, isConsultancyDomain } from './consultancyDomains';
import { PLATFORM_DOMAINS, isPlatformDomain } from './platformDomains';
import { getDiscoveryFilters, SHARED_EXCLUDE_DOMAIN_PATTERNS, SHARED_EXCLUDE_URL_PATTERNS } from './discoveryFilters';
import { getDomainRule } from './domainRules';

const TAVILY_API_URL = 'https://api.tavily.com/search';

// Debug and feature flags
const DISCOVERY_DEBUG = process.env.DISCOVERY_DEBUG === '1';
const DISCOVERY_TIME_BOUND = process.env.DISCOVERY_TIME_BOUND !== '0'; // Default ON

/**
 * Exact domains that are unconditionally excluded from search results.
 * These are known noise sources too specific to capture with a pattern.
 */
const HARD_EXCLUDE_DOMAINS = [
  'job.govdoc.lk',
  'data.montgomerycountymd.gov',
];

/**
 * Domain-name patterns for hard exclusion (applied before topic-level filters).
 * Extends the shared job/careers patterns from discoveryFilters with government,
 * military, and education TLDs that are never relevant editorial sources.
 */
const HARD_EXCLUDE_DOMAIN_PATTERNS: RegExp[] = [
  ...SHARED_EXCLUDE_DOMAIN_PATTERNS,
  /^job\./i,
  /^jobs\./i,
  /^careers\./i,
  /\.gov$/i,
  /\.gov\./i,
  /\.mil$/i,
  /\.edu$/i,
];

/**
 * URL path patterns for hard exclusion.
 * Extends the shared patterns from discoveryFilters with press-release pages,
 * which are editorial noise but not job-listing false-positives.
 */
const HARD_EXCLUDE_PATH_PATTERNS: RegExp[] = [
  ...SHARED_EXCLUDE_URL_PATTERNS,
  /\/press-releases\b/i,
];

function isHardExcludedDomain(domain: string): boolean {
  if (HARD_EXCLUDE_DOMAINS.includes(domain)) return true;
  return HARD_EXCLUDE_DOMAIN_PATTERNS.some(pattern => pattern.test(domain));
}

function isHardExcludedPath(pathname: string): boolean {
  return HARD_EXCLUDE_PATH_PATTERNS.some(pattern => pattern.test(pathname));
}

function getTavilyExcludeDomains(): string[] {
  return [
    ...HARD_EXCLUDE_DOMAINS,
    'gov',
    'mil',
    'edu'
  ];
}

export type SearchResult = {
  url: string;
  title: string;
  snippet: string;
  domain: string;
  publishedDate?: string;
  score?: number;
  topic: Topic;
};

type TavilyResponse = {
  query: string;
  response_time: number;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string;
    raw_content?: string;
  }>;
};

function getTavilyApiKey(): string {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    throw new Error('TAVILY_API_KEY not found in environment variables');
  }
  return key;
}

/**
 * Format a Date or ISO string to YYYY-MM-DD
 */
function formatDateYMD(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Build a time-bounded query by appending date constraints.
 * Uses both operator style (after:/before:) and plain English for broader compatibility.
 */
function buildTimeBoundQuery(cleanQuery: string, weekStart: Date | string, weekEnd: Date | string): string {
  const startStr = formatDateYMD(weekStart);
  const endStr = formatDateYMD(weekEnd);
  
  // Append both styles: operator-based and plain English
  return `${cleanQuery} after:${startStr} before:${endStr} published between ${startStr} and ${endStr}`;
}

export type TimeBoundOptions = {
  weekStart?: Date | string;
  weekEnd?: Date | string;
  weekLabel?: string;
};

async function searchTavily(
  query: string,
  maxResults: number = 20,
  targetDomains?: string[],
  timeBound?: TimeBoundOptions
): Promise<SearchResult[]> {
  const apiKey = getTavilyApiKey();

  // Extract domain from site: operator if present
  let includeDomains: string[] = [];
  let cleanQuery = query;
  
  if (query.includes('site:')) {
    const siteMatch = query.match(/site:([^\s]+)/);
    if (siteMatch) {
      const domain = siteMatch[1].replace(/^https?:\/\//, '').split('/')[0].replace('www.', '');
      includeDomains = [domain];
      // Remove site: operator from query (Tavily will use include_domains instead)
      cleanQuery = query.replace(/site:[^\s]+\s*/, '').trim();
    }
  }
  
  // Use provided targetDomains if available
  if (targetDomains && targetDomains.length > 0) {
    includeDomains = targetDomains;
  }

  // Apply time bound if enabled and dates provided
  let finalQuery = cleanQuery;
  if (DISCOVERY_TIME_BOUND && timeBound?.weekStart && timeBound?.weekEnd) {
    finalQuery = buildTimeBoundQuery(cleanQuery, timeBound.weekStart, timeBound.weekEnd);
    
    if (DISCOVERY_DEBUG) {
      console.log(`[Search:Debug] Time-bound query transformation:`);
      console.log(`  weekLabel: ${timeBound.weekLabel || 'N/A'}`);
      console.log(`  weekStart: ${formatDateYMD(timeBound.weekStart)}`);
      console.log(`  weekEnd: ${formatDateYMD(timeBound.weekEnd)}`);
      console.log(`  original: "${cleanQuery}"`);
      console.log(`  bounded:  "${finalQuery}"`);
    }
  } else if (DISCOVERY_DEBUG && timeBound?.weekStart && timeBound?.weekEnd) {
    console.log(`[Search:Debug] Time-bound DISABLED (DISCOVERY_TIME_BOUND=0), using original query`);
  }

  const excludeDomains = getTavilyExcludeDomains();

  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: finalQuery,
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
        include_domains: includeDomains.length > 0 ? includeDomains : [],
        exclude_domains: excludeDomains,
        max_results: maxResults,
        include_images: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tavily API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as TavilyResponse;
    
    return data.results.map(result => {
      const urlObj = new URL(result.url);
      return {
        url: result.url,
        title: result.title,
        snippet: result.content.substring(0, 300), // Limit snippet length
        domain: urlObj.hostname.replace('www.', ''),
        publishedDate: result.published_date,
        score: result.score,
        topic: 'AI_and_Strategy' as Topic // Placeholder, will be set by caller
      };
    });
  } catch (error: any) {
    console.error(`[Tavily] Error searching for "${query}":`, error.message);
    return [];
  }
}

export type SearchStats = Record<Topic, { 
  discovery_found: number;
  consultancy_found?: number; // Count of consultancy domain results (Tier 3)
  platform_found?: number; // Count of platform domain results (Tier 4)
}>;

export type DomainBreakdown = {
  total: number;
  byDomain: Record<string, number>;
  consultancy: number; // Tier 3
  platform: number; // Tier 4
};

export type SearchWithTavilyOptions = {
  weekStart?: Date | string;
  weekEnd?: Date | string;
  weekLabel?: string;
};

export async function searchWithTavily(
  queries: Record<Topic, string[]>,
  maxCandidates: number,
  discoveryDir: string,
  options?: SearchWithTavilyOptions
): Promise<{ results: SearchResult[]; stats: SearchStats; domainBreakdown: DomainBreakdown }> {
  const serpResultsPath = path.join(discoveryDir, 'serp-results.json');
  
  // Log time-bound configuration
  if (options?.weekStart && options?.weekEnd) {
    const startStr = formatDateYMD(options.weekStart);
    const endStr = formatDateYMD(options.weekEnd);
    console.log(`[Search] Time-bound search: ${startStr} to ${endStr} (week: ${options.weekLabel || 'N/A'})`);
    if (!DISCOVERY_TIME_BOUND) {
      console.log(`[Search] ⚠️  Time-bound DISABLED via DISCOVERY_TIME_BOUND=0`);
    }
  } else {
    console.log(`[Search] ⚠️  No time-bound dates provided, searching without date constraints`);
  }

  // Check if results already exist
  try {
    const existing = JSON.parse(await fs.readFile(serpResultsPath, 'utf-8'));
    const hasTopic = Array.isArray(existing) && existing.every(item => item.topic);
    if (!hasTopic) {
      console.warn(`[Search] Cached results missing topic metadata. Rebuilding search results.`);
      throw new Error('Cached search results missing topic');
    }
    console.log(`[Search] Using cached search results from ${serpResultsPath}`);
    const cachedStats: SearchStats = {
      "AI_and_Strategy": { discovery_found: 0, consultancy_found: 0, platform_found: 0 },
      "Ecommerce_Retail_Tech": { discovery_found: 0, consultancy_found: 0, platform_found: 0 },
      "Luxury_and_Consumer": { discovery_found: 0, consultancy_found: 0, platform_found: 0 },
      "Jewellery_Industry": { discovery_found: 0, consultancy_found: 0, platform_found: 0 }
    };
    const domainBreakdown: DomainBreakdown = {
      total: 0,
      byDomain: {},
      consultancy: 0,
      platform: 0
    };
    if (Array.isArray(existing)) {
      for (const item of existing) {
        const topic = item.topic as Topic | undefined;
        if (topic && cachedStats[topic]) {
          cachedStats[topic].discovery_found += 1;
          domainBreakdown.total += 1;
          
          const domain = item.domain || '';
          domainBreakdown.byDomain[domain] = (domainBreakdown.byDomain[domain] || 0) + 1;
          
          if (isConsultancyDomain(domain)) {
            cachedStats[topic].consultancy_found = (cachedStats[topic].consultancy_found || 0) + 1;
            domainBreakdown.consultancy += 1;
          } else if (isPlatformDomain(domain)) {
            cachedStats[topic].platform_found = (cachedStats[topic].platform_found || 0) + 1;
            domainBreakdown.platform += 1;
          }
        }
      }
    }
    return { results: existing, stats: cachedStats, domainBreakdown };
  } catch {
    // Continue to search
  }

  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();
  const searchReport = {
    droppedByExcludeDomain: 0,
    droppedByUrlPattern: 0,
    droppedBySoftExclude: 0,
    droppedByDomainRule: 0
  };
  const stats: SearchStats = {
    "AI_and_Strategy": { discovery_found: 0, consultancy_found: 0, platform_found: 0 },
    "Ecommerce_Retail_Tech": { discovery_found: 0, consultancy_found: 0, platform_found: 0 },
    "Luxury_and_Consumer": { discovery_found: 0, consultancy_found: 0, platform_found: 0 },
    "Jewellery_Industry": { discovery_found: 0, consultancy_found: 0, platform_found: 0 }
  };
  const domainBreakdown: DomainBreakdown = {
    total: 0,
    byDomain: {},
    consultancy: 0,
    platform: 0
  };

  // Build time-bound options for searchTavily
  const timeBound: TimeBoundOptions | undefined = (options?.weekStart && options?.weekEnd)
    ? { weekStart: options.weekStart, weekEnd: options.weekEnd, weekLabel: options.weekLabel }
    : undefined;

  // Search for each query
  for (const [topic, topicQueries] of Object.entries(queries)) {
    console.log(`[Search] Searching ${topicQueries.length} queries for ${topic}...`);
    
    for (const query of topicQueries) {
      // Extract domain from site: operator for Tavily include_domains
      let targetDomains: string[] | undefined;
      if (query.includes('site:')) {
        const siteMatch = query.match(/site:([^\s]+)/);
        if (siteMatch) {
          const domain = siteMatch[1].replace(/^https?:\/\//, '').split('/')[0].replace('www.', '');
          targetDomains = [domain];
        }
      }
      
      const results = await searchTavily(
        query,
        Math.ceil(maxCandidates / topicQueries.length),
        targetDomains,
        timeBound
      );
      
      for (const result of results) {
        const domain = result.domain || '';

        if (isHardExcludedDomain(domain)) {
          searchReport.droppedByExcludeDomain += 1;
          continue;
        }

        const urlObj = new URL(result.url);
        if (isHardExcludedPath(urlObj.pathname)) {
          searchReport.droppedByUrlPattern += 1;
          continue;
        }

        const filters = getDiscoveryFilters(topic as Topic);
        if (filters.domainPatterns.some(pattern => pattern.test(domain))) {
          searchReport.droppedBySoftExclude += 1;
          continue;
        }
        if (filters.urlPatterns.some(pattern => pattern.test(urlObj.pathname))) {
          searchReport.droppedByUrlPattern += 1;
          continue;
        }

        const domainRule = getDomainRule(domain);
        if (domainRule) {
          const allowPrefixes = domainRule.allowPathPrefixes || [];
          if (allowPrefixes.length > 0 && !allowPrefixes.some(prefix => urlObj.pathname.startsWith(prefix))) {
            searchReport.droppedByDomainRule += 1;
            continue;
          }
          const denyPrefixes = domainRule.denyPathPrefixes || [];
          if (denyPrefixes.some(prefix => urlObj.pathname.startsWith(prefix))) {
            searchReport.droppedByDomainRule += 1;
            continue;
          }
          if (domainRule.allowPathPrefixes && domainRule.allowPathPrefixes.length === 0) {
            searchReport.droppedByDomainRule += 1;
            continue;
          }
        }

        // Deduplicate by URL
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          allResults.push({ ...result, topic: topic as Topic });
          stats[topic as Topic].discovery_found += 1;
          domainBreakdown.total += 1;
          
          // Track domain breakdown
          domainBreakdown.byDomain[domain] = (domainBreakdown.byDomain[domain] || 0) + 1;
          
          // Track consultancy domains (Tier 3)
          if (isConsultancyDomain(domain)) {
            stats[topic as Topic].consultancy_found = (stats[topic as Topic].consultancy_found || 0) + 1;
            domainBreakdown.consultancy += 1;
          } else if (isPlatformDomain(domain)) {
            // Track platform domains (Tier 4)
            stats[topic as Topic].platform_found = (stats[topic as Topic].platform_found || 0) + 1;
            domainBreakdown.platform += 1;
          }
        }
      }
      
      // Rate limiting - wait a bit between queries
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Limit to maxCandidates
  const limitedResults = allResults.slice(0, maxCandidates);

  // Save results
  await fs.mkdir(discoveryDir, { recursive: true });
  await fs.writeFile(serpResultsPath, JSON.stringify(limitedResults, null, 2), 'utf-8');
  await fs.writeFile(
    path.join(discoveryDir, 'search-report.json'),
    JSON.stringify(searchReport, null, 2),
    'utf-8'
  );

  // Log domain breakdown
  console.log(`\n=== DOMAIN BREAKDOWN ===`);
  console.log(`Total candidates: ${domainBreakdown.total}`);
  console.log(`Consultancy domains (Tier 3): ${domainBreakdown.consultancy}`);
  console.log(`Platform domains (Tier 4): ${domainBreakdown.platform}`);
  if (domainBreakdown.consultancy > 0) {
    console.log(`\nTop consultancy domains (Tier 3):`);
    const consultancyDomains = Object.entries(domainBreakdown.byDomain)
      .filter(([domain]) => isConsultancyDomain(domain))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [domain, count] of consultancyDomains) {
      console.log(`  ${domain}: ${count}`);
    }
  }
  if (domainBreakdown.platform > 0) {
    console.log(`\nTop platform domains (Tier 4):`);
    const platformDomains = Object.entries(domainBreakdown.byDomain)
      .filter(([domain]) => isPlatformDomain(domain))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [domain, count] of platformDomains) {
      console.log(`  ${domain}: ${count}`);
    }
  }
  console.log(`\nTop domains overall:`);
  const topDomains = Object.entries(domainBreakdown.byDomain)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [domain, count] of topDomains) {
    console.log(`  ${domain}: ${count}`);
  }

  return { results: limitedResults, stats, domainBreakdown };
}
