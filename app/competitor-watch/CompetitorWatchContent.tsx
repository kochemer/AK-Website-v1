import Link from 'next/link';
import { COMPETITOR_BRANDS, type CompetitorId } from '@/lib/constants/competitorBrands';
import { getMessages } from '@/lib/i18n/messages';
import type { Locale } from '@/lib/i18n/types';
import type { Article } from '@/lib/types/article';
import ArticleCard from '@/app/components/ArticleCard';
import BrandFilterBar, { type BrandSummary } from '@/app/components/BrandFilterBar';

type Props = {
  brandMap: Map<CompetitorId, Article[]>;
  activeBrand: string | undefined;
  locale: Locale;
  basePath: string;
};

export default function CompetitorWatchContent({
  brandMap,
  activeBrand,
  locale,
  basePath,
}: Props) {
  const t = getMessages(locale);

  // Brand summaries for the filter bar (only show brands with articles)
  const brandSummaries: BrandSummary[] = COMPETITOR_BRANDS.map((b) => ({
    id: b.id,
    name: b.name,
    count: brandMap.get(b.id)?.length ?? 0,
  }));

  // Resolve active brand label for the section header
  const activeBrandName = activeBrand
    ? COMPETITOR_BRANDS.find((b) => b.id === activeBrand)?.name
    : undefined;

  // Build the article list
  // Single brand: show just that brand's articles
  // All brands: deduplicate by URL, attach all matching brand names as badges, sort by recency
  type Row = { article: Article; badges: string[] };
  let rows: Row[] = [];

  if (activeBrand) {
    const bucket = brandMap.get(activeBrand as CompetitorId) ?? [];
    rows = bucket.map((article) => ({
      article,
      badges: [COMPETITOR_BRANDS.find((b) => b.id === activeBrand)?.name ?? activeBrand],
    }));
  } else {
    // Deduplicate across all brand buckets; collect all brand names per article
    const seen = new Map<string, Row>();
    for (const brand of COMPETITOR_BRANDS) {
      for (const article of brandMap.get(brand.id) ?? []) {
        if (!seen.has(article.url)) {
          seen.set(article.url, { article, badges: [] });
        }
        seen.get(article.url)!.badges.push(brand.name);
      }
    }
    rows = Array.from(seen.values()).sort((a, b) => {
      const dateA = a.article.published_at || a.article.ingested_at || '';
      const dateB = b.article.published_at || b.article.ingested_at || '';
      return dateB.localeCompare(dateA);
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-16">
      {/* Header */}
      <header className="mb-10">
        <Link
          href={locale === 'en' ? '/' : `/${locale}`}
          className="text-[var(--color-accent)] hover:text-[var(--color-text-primary)] text-[13px] inline-block mb-6 transition-colors"
        >
          ← {t.nav.home}
        </Link>
        <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-accent)] font-sans font-semibold mb-3">
          Intelligence
        </p>
        <h1 className="font-serif font-normal text-[2.25rem] leading-tight tracking-[-0.02em] text-[var(--color-text-primary)] mb-4">
          {t.competitorWatch.pageTitle}
        </h1>
        <p className="text-body text-[var(--color-text-secondary)] max-w-2xl">
          {t.competitorWatch.pageDescription}
        </p>
        <hr className="border-[var(--color-accent)] border-t-2 mt-6" />
      </header>

      {/* Brand filter bar */}
      <BrandFilterBar
        brands={brandSummaries}
        activeBrand={activeBrand}
        basePath={basePath}
        allBrandsLabel={t.competitorWatch.allBrands}
      />

      {/* Section label + count */}
      <div className="flex items-center justify-between mt-8 mb-6">
        <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-secondary)] font-sans font-semibold">
          {activeBrandName ?? t.competitorWatch.latestIntelligence}
        </h2>
        <span className="text-[13px] text-[var(--color-text-secondary)]">
          {rows.length} article{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Articles */}
      {rows.length === 0 ? (
        <div className="bg-[var(--color-accent-light)] border-l-4 border-[var(--color-accent)] p-5 rounded-sm">
          <p className="text-body text-[var(--color-text-primary)]">
            {t.competitorWatch.noArticles}
          </p>
        </div>
      ) : (
        <ul>
          {rows.map(({ article, badges }) => (
            <li key={article.url}>
              <ArticleCard
                title={article.title}
                url={article.url}
                source={article.source}
                date={article.published_at}
                summary={article.aiSummary}
                badges={badges}
                locale={locale}
                translations={article.translations}
                aiSummaryLabel={t.digest.aiSummary}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
