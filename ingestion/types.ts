/**
 * Ingestion-specific types.
 * 
 * Note: Article type is now in @/lib/types/article.ts
 * This file only contains source configuration types.
 */

// Re-export Article from canonical location for backward compatibility
export type { Article } from '../lib/types';

export type SourceFeed = {
  name: string;
  url: string;
  tier?: 1 | 2 | 3 | 4 | 5 | 6; // Source tier classification
  sourceType?: 'news' | 'retail' | 'academic' | 'specialist' | 'consultancy' | 'platform' | 'fashion_luxury' | 'jewellery'; // Source type for categorization
  categoryHint?: 'Fashion & Luxury' | 'Jewellery Industry'; // Optional hint for classification (non-binding)
};

export type SourcePage = {
  name: string;
  url: string;
  selectors: {
    item: string;
    title?: string;
    link: string;
    date?: string;
  };
  linkAttr?: string;
  dateFormatHint?: string;
  fallbackSelectors?: {
    item: string;
    title?: string;
    link: string;
    date?: string;
  };
  sourceType?: 'consultancy' | 'news' | 'blog' | 'fashion_luxury' | 'jewellery' | 'retail'; // Optional: categorize source type for future weighting
  categoryHint?: 'Fashion & Luxury' | 'Jewellery Industry'; // Optional hint for classification (non-binding)
};
