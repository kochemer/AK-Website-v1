import type { Metadata } from 'next';
import { loadCompetitorArticles } from '@/lib/utils/loadCompetitorArticles';
import CompetitorWatchContent from './CompetitorWatchContent';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Competitor Watch — Jewellery Brand Intelligence',
  description:
    "Track news and coverage of Pandora's key jewellery competitors: Tiffany, Cartier, De Beers, Signet, Swarovski, Mejuri, Monica Vinader, Bulgari, and Van Cleef & Arpels.",
};

export default async function CompetitorWatchPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand } = await searchParams;
  const brandMap = await loadCompetitorArticles();

  return (
    <CompetitorWatchContent
      brandMap={brandMap}
      activeBrand={brand}
      locale="en"
      basePath="/competitor-watch"
    />
  );
}
