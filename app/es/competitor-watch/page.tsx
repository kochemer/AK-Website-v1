import { loadCompetitorArticles } from '@/lib/utils/loadCompetitorArticles';
import CompetitorWatchContent from '@/app/competitor-watch/CompetitorWatchContent';

export const dynamic = 'force-dynamic';

export default async function CompetitorWatchES({
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
      locale="es"
      basePath="/es/competitor-watch"
    />
  );
}
