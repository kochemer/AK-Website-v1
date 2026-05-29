import type { Metadata } from 'next';
import { loadCompetitorArticles } from '@/lib/utils/loadCompetitorArticles';
import { loadCompetitorIntel } from '@/lib/utils/loadCompetitorIntel';
import CompetitorWatchContent from '@/app/competitor-watch/CompetitorWatchContent';

export const metadata: Metadata = { robots: { index: false, follow: true } };

export const dynamic = 'force-dynamic';

export default async function CompetitorWatchDA({
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
      locale="da"
      basePath="/da/competitor-watch"
    />
  );
}
