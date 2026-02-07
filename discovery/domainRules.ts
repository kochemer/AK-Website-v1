export type DomainRule = {
  domain: string;
  allowPathPrefixes?: string[];
  denyPathPrefixes?: string[];
  dateSelectors?: {
    meta?: string[];
    jsonld?: boolean;
    cssTime?: string[];
  };
};

export const DOMAIN_RULES: DomainRule[] = [
  {
    domain: 'corporate.walmart.com',
    allowPathPrefixes: ['/news', '/newsroom', '/press', '/stories']
  },
  {
    domain: 'shopify.com',
    allowPathPrefixes: ['/blog', '/news', '/partners/blog', '/enterprise/blog'],
    denyPathPrefixes: ['/editions', '/guides']
  },
  {
    domain: 'slickdeals.net',
    allowPathPrefixes: [] // default to exclude unless a specific prefix is added
  }
];

export function getDomainRule(domain: string): DomainRule | undefined {
  return DOMAIN_RULES.find(rule => rule.domain === domain);
}
