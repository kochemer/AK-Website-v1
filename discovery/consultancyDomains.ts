/**
 * Tier 3: Consultancy domain allowlist for domain-targeted discovery.
 * These domains are captured via web discovery queries (site: operators)
 * rather than page scraping due to blocking/JS-rendering issues.
 * 
 * Includes: McKinsey, Bain, BCG, Deloitte, EY, Salesforce, Adobe, DHL
 */

export const CONSULTANCY_DOMAINS = [
  "mckinsey.com",
  "bain.com",
  "bcg.com",
  "deloitte.com",
  "ey.com",
  "salesforce.com",
  "adobe.com",
  "dhl.com"
] as const;

export type ConsultancyDomain = typeof CONSULTANCY_DOMAINS[number];

/**
 * Check if a domain is a consultancy domain
 */
export function isConsultancyDomain(domain: string): boolean {
  const normalizedDomain = domain.toLowerCase().replace('www.', '');
  return CONSULTANCY_DOMAINS.some(consultancyDomain => 
    normalizedDomain === consultancyDomain || normalizedDomain.endsWith(`.${consultancyDomain}`)
  );
}

/**
 * Generate consultancy-targeted queries for a category
 * Returns 4 queries per category that target consultancy domains
 */
export function generateConsultancyQueries(topic: string, categoryLabel: string): string[] {
  const queries: string[] = [];
  
  const topicQueries: Record<string, { mckinsey: string; bain: string; bcg: string; deloitte: string }> = {
    "AI_and_Strategy": {
      mckinsey: "site:mckinsey.com artificial intelligence strategy",
      bain: "site:bain.com/insights artificial intelligence",
      bcg: "site:bcg.com artificial intelligence insights",
      deloitte: "site:deloitte.com artificial intelligence insights"
    },
    "Ecommerce_Retail_Tech": {
      mckinsey: "site:mckinsey.com retail consumer insights",
      bain: "site:bain.com/insights retail technology",
      bcg: "site:bcg.com retail consumer products insights",
      deloitte: "site:deloitte.com retail commerce technology"
    },
    "Luxury_and_Consumer": {
      mckinsey: "site:mckinsey.com luxury consumer trends",
      bain: "site:bain.com/insights luxury consumer",
      bcg: "site:bcg.com luxury consumer insights",
      deloitte: "site:deloitte.com luxury consumer trends"
    },
    "Jewellery_Industry": {
      mckinsey: "site:mckinsey.com luxury retail insights",
      bain: "site:bain.com/insights luxury retail",
      bcg: "site:bcg.com luxury retail insights",
      deloitte: "site:deloitte.com luxury retail jewellery"
    }
  };
  
  const patterns = topicQueries[topic];
  if (patterns) {
    queries.push(patterns.mckinsey);
    queries.push(patterns.bain);
    queries.push(patterns.bcg);
    queries.push(patterns.deloitte);
  } else {
    queries.push(`site:mckinsey.com ${categoryLabel.toLowerCase()}`);
    queries.push(`site:bain.com/insights ${categoryLabel.toLowerCase()}`);
    queries.push(`site:bcg.com ${categoryLabel.toLowerCase()}`);
    queries.push(`site:deloitte.com ${categoryLabel.toLowerCase()}`);
  }
  
  return queries;
}
