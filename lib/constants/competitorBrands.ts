/**
 * Competitor brand registry for the Competitor Watch page.
 * Each brand has a canonical id, display name, aliases used for text matching,
 * and optional financial data fields (ticker, parent company name, isPublic).
 */

export const COMPETITOR_BRANDS = [
  {
    id: 'signet',
    name: 'Signet Jewelers',
    aliases: ['signet', 'kay jewelers', 'kay jeweller', 'zales', 'jared'],
    isPublic: true,
    ticker: 'SIG',
    tickerParent: 'Signet Jewelers',
  },
  {
    id: 'swarovski',
    name: 'Swarovski',
    aliases: ['swarovski'],
    isPublic: false,
  },
  {
    id: 'mejuri',
    name: 'Mejuri',
    aliases: ['mejuri'],
    isPublic: false,
  },
  {
    id: 'monica-vinader',
    name: 'Monica Vinader',
    aliases: ['monica vinader'],
    isPublic: false,
  },
  {
    id: 'tiffany',
    name: 'Tiffany & Co.',
    aliases: ['tiffany & co', 'tiffany and co', 'tiffany'],
    isPublic: true,
    ticker: 'MC.PA',
    tickerParent: 'LVMH',
  },
  {
    id: 'cartier',
    name: 'Cartier',
    aliases: ['cartier'],
    isPublic: true,
    ticker: 'CFR.SW',
    tickerParent: 'Richemont',
  },
  {
    id: 'de-beers',
    name: 'De Beers',
    aliases: ['de beers'],
    isPublic: false,
  },
  {
    id: 'bulgari',
    name: 'Bulgari',
    aliases: ['bulgari', 'bvlgari'],
    isPublic: true,
    ticker: 'MC.PA',
    tickerParent: 'LVMH',
  },
  {
    id: 'van-cleef',
    name: 'Van Cleef & Arpels',
    aliases: ['van cleef & arpels', 'van cleef and arpels', 'van cleef'],
    isPublic: true,
    ticker: 'CFR.SW',
    tickerParent: 'Richemont',
  },
  {
    id: 'pandora',
    name: 'Pandora',
    aliases: ['pandora'],
    isPublic: true,
    ticker: 'PNDORA.CO',
    tickerParent: 'Pandora A/S',
  },
] as const;

export type CompetitorId = (typeof COMPETITOR_BRANDS)[number]['id'];

export type CompetitorBrand = {
  id: CompetitorId;
  name: string;
  count: number;
};
