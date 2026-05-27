import type { Metadata } from 'next';
import { loadCompetitorArticles } from '@/lib/utils/loadCompetitorArticles';
import { loadCompetitorIntel } from '@/lib/utils/loadCompetitorIntel';
import CompetitorWatchContent from '@/app/competitor-watch/CompetitorWatchContent';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = 'force-dynamic';

export default async function CompetitorWatchES({
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
      locale="es"
      basePath="/es/competitor-watch"
    />
  );
}
