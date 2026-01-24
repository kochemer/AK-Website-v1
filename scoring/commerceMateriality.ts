/**
 * Commerce Materiality Scoring
 * 
 * Deterministic scoring (0-10) that identifies articles with real-world commerce execution impact.
 * High materiality = platform capabilities, checkout/cart changes, retailer adoption, monetization changes.
 * Low materiality = commentary/discourse without deployment.
 */

export type CommerceMaterialityResult = {
  score: number; // 0-10
  signals: string[]; // Top matched signals for transparency/debugging
};

export type ArticleInput = {
  title: string;
  source?: string;
  snippet?: string;
  aiSummary?: string;
  fullText?: string;
};

// Configuration weights
const WEIGHT_SHIPPING_VERBS = 2;
const WEIGHT_TRANSACTION_INTENT = 3;
const WEIGHT_PLATFORM_RETAILER = 3;
const WEIGHT_PARTNER_STANDARD = 2;
const PENALTY_DISCOURSE = -2;
const PENALTY_NO_COMMERCE_NOUNS = -1;

// Positive signals

// A) Shipping/rollout verbs
const SHIPPING_VERBS = [
  'rolls out', 'rollout', 'roll-out',
  'launches', 'launch',
  'unveils', 'unveil',
  'introduces', 'introduce',
  'enables', 'enable',
  'now supports', 'supports',
  'goes live', 'go live', 'going live',
  'released', 'release',
  'ga', 'generally available',
  'deploys', 'deploy',
  'activates', 'activate',
  'implements', 'implement',
  'ships', 'ship'
];

// B) Transaction intent keywords
const TRANSACTION_KEYWORDS = [
  'checkout', 'cart', 'shopping cart',
  'buy directly', 'purchase', 'order',
  'payment', 'payments', 'pay',
  'conversion', 'conversions',
  'merchant', 'merchants',
  'inventory', 'fulfillment',
  'shipping', 'returns', 'return',
  'billing', 'invoice', 'invoicing',
  'subscription', 'subscriptions',
  'revenue', 'sales', 'revenue stream'
];

// C) Platform keywords
const PLATFORM_KEYWORDS = [
  'google', 'gemini',
  'openai', 'chatgpt',
  'microsoft', 'copilot',
  'amazon', 'aws',
  'shopify', 'shopify plus',
  'apple', 'ios', 'app store',
  'meta', 'facebook',
  'tiktok shop', 'tiktok',
  'alibaba', 'alipay',
  'stripe', 'paypal',
  'square', 'adobe commerce', 'magento',
  'salesforce', 'commerce cloud'
];

// Retailer/commerce keywords
const RETAILER_KEYWORDS = [
  'retailer', 'retailers',
  'merchant', 'merchants',
  'brand', 'brands',
  'store', 'stores',
  'ecommerce', 'e-commerce', 'e commerce',
  'marketplace', 'marketplaces',
  'walmart', 'target', 'costco',
  'jd sports', 'jd', 'etsy',
  'ebay', 'amazon marketplace',
  'best buy', 'home depot',
  'nike', 'adidas', 'zara',
  'h&m', 'hm', 'inditex'
];

// D) Partner/interoperability/standard keywords
const PARTNER_STANDARD_KEYWORDS = [
  'protocol', 'protocols',
  'standard', 'standards',
  'api', 'apis',
  'integration', 'integrations',
  'partners', 'partner',
  'interoperable', 'interoperability',
  'sdk', 'sdks',
  'connector', 'connectors'
];

// Negative signals

// E) Discourse-only / non-execution framing
const DISCOURSE_MARKERS = [
  'alarm', 'concern', 'concerns',
  'ethics', 'ethical',
  'misuse', 'abuse',
  'controversy', 'controversial',
  'debate', 'debates',
  'regulators warn', 'regulator warns',
  'universities', 'university',
  'students', 'student',
  'education', 'educational',
  'literacy', 'teaching',
  'pilot', 'pilots', 'pilot program',
  'research', 'study', 'studies',
  'academic', 'academics'
];

/**
 * Compute commerce materiality score for an article
 */
export function computeCommerceMateriality(article: ArticleInput): CommerceMaterialityResult {
  const signals: string[] = [];
  let score = 0;

  // Combine all text sources
  const combinedText = [
    article.title || '',
    article.source || '',
    article.snippet || '',
    article.aiSummary || '',
    article.fullText || ''
  ].join(' ').toLowerCase();

  // A) Shipping/rollout verbs (+2)
  const hasShippingVerb = SHIPPING_VERBS.some(verb => 
    combinedText.includes(verb.toLowerCase())
  );
  if (hasShippingVerb) {
    score += WEIGHT_SHIPPING_VERBS;
    signals.push('shipping/rollout verb');
  }

  // B) Transaction intent keywords (+3)
  const transactionMatches = TRANSACTION_KEYWORDS.filter(keyword =>
    combinedText.includes(keyword.toLowerCase())
  );
  if (transactionMatches.length > 0) {
    score += WEIGHT_TRANSACTION_INTENT;
    signals.push(`transaction intent (${transactionMatches.slice(0, 2).join(', ')})`);
  }

  // C) Platform + retailer integration (+3)
  const hasPlatform = PLATFORM_KEYWORDS.some(platform =>
    combinedText.includes(platform.toLowerCase())
  );
  const hasRetailer = RETAILER_KEYWORDS.some(retailer =>
    combinedText.includes(retailer.toLowerCase())
  );
  if (hasPlatform && hasRetailer) {
    score += WEIGHT_PLATFORM_RETAILER;
    signals.push('platform + retailer integration');
  } else if (hasPlatform) {
    // Partial credit if just platform mentioned
    score += 1;
    signals.push('platform mentioned');
  } else if (hasRetailer) {
    // Partial credit if just retailer mentioned
    score += 1;
    signals.push('retailer mentioned');
  }

  // D) Partner/interoperability/standard (+2)
  const hasPartnerStandard = PARTNER_STANDARD_KEYWORDS.some(keyword =>
    combinedText.includes(keyword.toLowerCase())
  );
  if (hasPartnerStandard) {
    score += WEIGHT_PARTNER_STANDARD;
    signals.push('partner/standard/integration');
  }

  // E) Discourse-only penalty (-2)
  const hasDiscourseMarker = DISCOURSE_MARKERS.some(marker =>
    combinedText.includes(marker.toLowerCase())
  );
  if (hasDiscourseMarker) {
    score += PENALTY_DISCOURSE;
    signals.push('discourse-only marker');
  }

  // F) No commerce nouns penalty (-1)
  const hasCommerceNouns = TRANSACTION_KEYWORDS.some(keyword =>
    combinedText.includes(keyword.toLowerCase())
  ) || RETAILER_KEYWORDS.some(keyword =>
    combinedText.includes(keyword.toLowerCase())
  );
  if (!hasCommerceNouns && !hasPlatform && !hasRetailer) {
    score += PENALTY_NO_COMMERCE_NOUNS;
    signals.push('no commerce nouns');
  }

  // Clamp to 0-10
  score = Math.max(0, Math.min(10, score));

  return {
    score,
    signals: signals.length > 0 ? signals : ['no signals matched']
  };
}

/**
 * Get top N articles by commerce materiality score
 */
export function getTopByMateriality<T extends ArticleInput>(
  articles: T[],
  topN: number
): Array<T & { commerceMateriality: CommerceMaterialityResult }> {
  const withScores = articles.map(article => ({
    ...article,
    commerceMateriality: computeCommerceMateriality(article)
  }));

  // Sort by score descending, then by title for determinism
  withScores.sort((a, b) => {
    if (b.commerceMateriality.score !== a.commerceMateriality.score) {
      return b.commerceMateriality.score - a.commerceMateriality.score;
    }
    return a.title.localeCompare(b.title);
  });

  return withScores.slice(0, topN);
}
