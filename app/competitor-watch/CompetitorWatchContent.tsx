import Link from 'next/link';
import { COMPETITOR_BRANDS, type CompetitorId } from '@/lib/constants/competitorBrands';
import { getMessages } from '@/lib/i18n/messages';
import type { Locale } from '@/lib/i18n/types';
import type { Article, SignalTag } from '@/lib/types/article';
import type { CompetitorIntel } from '@/lib/utils/loadCompetitorIntel';
import ArticleCard from '@/app/components/ArticleCard';
import BrandFilterBar, { type BrandSummary } from '@/app/components/BrandFilterBar';
import CompetitorBriefing from '@/app/components/CompetitorBriefing';
import BrandProfileCard from '@/app/components/BrandProfileCard';

const SIGNAL_TAGS: SignalTag[] = [
  'Launch', 'Campaign', 'Partnership', 'Financials',
  'Controversy', 'Leadership', 'Expansion',
];

const SIGNAL_COLORS: Record<SignalTag, string> = {
  Launch: 'bg-blue-50 text-blue-700 border-blue-200',
  Campaign: 'bg-purple-50 text-purple-700 border-purple-200',
  Partnership: 'bg-teal-50 text-teal-700 border-teal-200',
  Financials: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Controversy: 'bg-red-50 text-red-700 border-red-200',
  Leadership: 'bg-orange-50 text-orange-700 border-orange-200',
  Expansion: 'bg-green-50 text-green-700 border-green-200',
};

type Props = {
  brandMap: Map<CompetitorId, Article[]>;
  activeBrand: string | undefined;
  activeSignal: string | undefined;
  intel: CompetitorIntel;
  locale: Locale;
  basePath: string;
};

export default function CompetitorWatchContent({
  brandMap,
  activeBrand,
  activeSignal,
  intel,
  locale,
  basePath,
}: Props) {
  const t = getMessages(locale);

  // Brand summaries for filter bar
  const brandSummaries: BrandSummary[] = COMPETITOR_BRANDS.map(b => ({
    id: b.id,
    name: b.name,
    count: brandMap.get(b.id)?.length ?? 0,
  }));

  const activeBrandName = activeBrand
    ? COMPETITOR_BRANDS.find(b => b.id === activeBrand)?.name
    : undefined;

  // Build deduplicated article rows with brand badges and signal tags
  type Row = { article: Article; badges: string[] };
  let allRows: Row[] = [];

  if (activeBrand) {
    const bucket = brandMap.get(activeBrand as CompetitorId) ?? [];
    allRows = bucket.map(article => ({
      article,
      badges: [COMPETITOR_BRANDS.find(b => b.id === activeBrand)?.name ?? activeBrand],
    }));
  } else {
    const seen = new Map<string, Row>();
    for (const brand of COMPETITOR_BRANDS) {
      for (const article of brandMap.get(brand.id) ?? []) {
        if (!seen.has(article.url)) {
          seen.set(article.url, { article, badges: [] });
        }
        seen.get(article.url)!.badges.push(brand.name);
      }
    }
    allRows = Array.from(seen.values()).sort((a, b) => {
      const dateA = a.article.published_at || a.article.ingested_at || '';
      const dateB = b.article.published_at || b.article.ingested_at || '';
      return dateB.localeCompare(dateA);
    });
  }

  // Signal filter
  const activeSignalTag = SIGNAL_TAGS.find(s => s.toLowerCase() === activeSignal?.toLowerCase());
  const filteredRows = activeSignalTag
    ? allRows.filter(r => r.article.signalTag === activeSignalTag)
    : allRows;

  // Controversies: all controversy-tagged articles across all brands
  const controversyRows = allRows.filter(r => r.article.signalTag === 'Controversy');

  // Determine if we're in filtered mode (brand or signal selected)
  const isFiltered = !!activeBrand || !!activeSignalTag;

  // Build signal filter URL helper
  const buildSignalUrl = (signal: SignalTag | null) => {
    const params = new URLSearchParams();
    if (activeBrand) params.set('brand', activeBrand);
    if (signal) params.set('signal', signal.toLowerCase());
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

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

      {/* ── Section 1: Weekly Briefing (only on unfiltered view) ── */}
      {!isFiltered && (
        <CompetitorBriefing
          bullets={intel.briefing}
          generatedAt={intel.generatedAt}
        />
      )}

      {/* ── Section 2: Brand Profiles (only on unfiltered view) ── */}
      {!isFiltered && (
        <section className="mb-12">
          <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-secondary)] font-sans font-semibold mb-6">
            Brand Profiles
          </p>
          <div className="grid grid-cols-1 gap-6">
            {COMPETITOR_BRANDS.map(brand => {
              const articles = brandMap.get(brand.id) ?? [];
              if (articles.length === 0 && !intel.brands[brand.id]?.narrative) return null;
              return (
                <BrandProfileCard
                  key={brand.id}
                  brandId={brand.id}
                  brandName={brand.name}
                  isPublic={'isPublic' in brand ? brand.isPublic : false}
                  articles={articles}
                  intel={intel.brands[brand.id]}
                  locale={locale}
                  basePath={basePath}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Section 4: Controversies & Risks (only on unfiltered view) ── */}
      {!isFiltered && controversyRows.length > 0 && (
        <section className="mb-12">
          <div className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded-sm px-5 py-4">
            <p className="text-[11px] tracking-[0.3em] uppercase text-amber-700 dark:text-amber-400 font-sans font-semibold mb-4">
              Controversies & Risks
            </p>
            <ul>
              {controversyRows.map(({ article, badges }) => (
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
          </div>
        </section>
      )}

      {/* ── Section 3: Signal Filter Feed ── */}
      <section>
        {/* Brand filter bar */}
        <BrandFilterBar
          brands={brandSummaries}
          activeBrand={activeBrand}
          basePath={basePath}
          allBrandsLabel={t.competitorWatch.allBrands}
        />

        {/* Signal type filter bar */}
        <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Filter by signal type">
          <a
            href={buildSignalUrl(null)}
            className={`px-3 py-1.5 rounded-[3px] text-sm font-medium font-sans border transition-colors ${
              !activeSignalTag
                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                : 'bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
            }`}
          >
            All signals
          </a>
          {SIGNAL_TAGS.map(signal => (
            <a
              key={signal}
              href={buildSignalUrl(signal)}
              className={`px-3 py-1.5 rounded-[3px] text-sm font-medium font-sans border transition-colors ${
                activeSignalTag === signal
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                  : `bg-transparent border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]`
              }`}
            >
              {signal}
            </a>
          ))}
        </div>

        {/* Section label + count */}
        <div className="flex items-center justify-between mt-8 mb-6">
          <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-secondary)] font-sans font-semibold">
            {activeBrandName
              ? `${activeBrandName}${activeSignalTag ? ` · ${activeSignalTag}` : ''}`
              : activeSignalTag
              ? activeSignalTag
              : t.competitorWatch.latestIntelligence}
          </h2>
          <span className="text-[13px] text-[var(--color-text-secondary)]">
            {filteredRows.length} article{filteredRows.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Articles */}
        {filteredRows.length === 0 ? (
          <div className="bg-[var(--color-accent-light)] border-l-4 border-[var(--color-accent)] p-5 rounded-sm">
            <p className="text-body text-[var(--color-text-primary)]">
              {t.competitorWatch.noArticles}
            </p>
          </div>
        ) : (
          <ul>
            {filteredRows.map(({ article, badges }) => (
              <li key={article.url}>
                <ArticleCard
                  title={article.title}
                  url={article.url}
                  source={article.source}
                  date={article.published_at}
                  summary={article.aiSummary}
                  badges={[
                    ...badges,
                    ...(article.signalTag ? [article.signalTag] : []),
                  ]}
                  locale={locale}
                  translations={article.translations}
                  aiSummaryLabel={t.digest.aiSummary}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Section 5: Pandora Reference Strip ── */}
      {!isFiltered && (
        <aside className="mt-16 pt-8 border-t border-[var(--color-border)]">
          <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-secondary)] font-sans font-semibold mb-3">
            Pandora Reference
          </p>
          <p className="text-body text-[var(--color-text-secondary)] max-w-2xl">
            Pandora is the world's largest jewellery brand by volume. Price tier: affordable-premium (€10–€300). Key markets: Europe, Americas, Asia-Pacific. Differentiators: charm system, personalisation, accessible luxury, scale manufacturing, wide retail network. Listed on Nasdaq Copenhagen (PNDORA).
          </p>
        </aside>
      )}
    </div>
  );
}
