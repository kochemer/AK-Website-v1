import type { Metadata } from 'next';
import { loadCompetitorArticles } from '@/lib/utils/loadCompetitorArticles';
import { loadCompetitorIntel } from '@/lib/utils/loadCompetitorIntel';
import CompetitorWatchContent from './CompetitorWatchContent';
import { getSiteUrl } from '@/lib/utils/siteUrl';

export const dynamic = 'force-dynamic';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: 'Competitor Watch — Jewellery Brand Intelligence',
  description:
    "Track news and coverage of Pandora's key jewellery competitors: Tiffany, Cartier, De Beers, Signet, Swarovski, Mejuri, Monica Vinader, Bulgari, and Van Cleef & Arpels.",
  robots: { index: false, follow: true },
  alternates: {
    canonical: `${siteUrl}/competitor-watch`,
  },
};

export default async function CompetitorWatchPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; signal?: string }>;
}) {
  const { brand, signal } = await searchParams;
  const [brandMap, intel] = await Promise.all([
    loadCompetitorArticles(),
    loadCompetitorIntel(),
  ]);

  return (
    <CompetitorWatchContent
      brandMap={brandMap}
      activeBrand={brand}
      activeSignal={signal}
      intel={intel}
      locale="en"
      basePath="/competitor-watch"
    />
  );
}
