/**
 * Competitor brand registry for the Competitor Watch page.
 * Each brand has a canonical id, display name, and aliases used for text matching.
 */

export const COMPETITOR_BRANDS = [
  {
    id: 'signet',
    name: 'Signet Jewelers',
    aliases: ['signet', 'kay jewelers', 'kay jeweller', 'zales', 'jared'],
  },
  {
    id: 'swarovski',
    name: 'Swarovski',
    aliases: ['swarovski'],
  },
  {
    id: 'mejuri',
    name: 'Mejuri',
    aliases: ['mejuri'],
  },
  {
    id: 'monica-vinader',
    name: 'Monica Vinader',
    aliases: ['monica vinader'],
  },
  {
    id: 'tiffany',
    name: 'Tiffany & Co.',
    aliases: ['tiffany & co', 'tiffany and co', 'tiffany'],
  },
  {
    id: 'cartier',
    name: 'Cartier',
    aliases: ['cartier'],
  },
  {
    id: 'de-beers',
    name: 'De Beers',
    aliases: ['de beers'],
  },
  {
    id: 'bulgari',
    name: 'Bulgari',
    aliases: ['bulgari', 'bvlgari'],
  },
  {
    id: 'van-cleef',
    name: 'Van Cleef & Arpels',
    aliases: ['van cleef & arpels', 'van cleef and arpels', 'van cleef'],
  },
  {
    id: 'pandora',
    name: 'Pandora',
    aliases: ['pandora'],
  },
] as const;

export type CompetitorId = (typeof COMPETITOR_BRANDS)[number]['id'];

export type CompetitorBrand = {
  id: CompetitorId;
  name: string;
  count: number;
};
