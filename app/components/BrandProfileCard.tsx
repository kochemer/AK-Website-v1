import type { Article } from '@/lib/types/article';
import type { BrandIntel } from '@/lib/utils/loadCompetitorIntel';
import type { CompetitorId } from '@/lib/constants/competitorBrands';
import ArticleCard from './ArticleCard';
import FinancialPulse from './FinancialPulse';

const SIGNAL_COLORS: Record<string, string> = {
  Launch:      'bg-blue-950/50 text-blue-300 border-blue-800/40',
  Campaign:    'bg-purple-950/50 text-purple-300 border-purple-800/40',
  Partnership: 'bg-teal-950/50 text-teal-300 border-teal-800/40',
  Financials:  'bg-yellow-950/50 text-yellow-300 border-yellow-800/40',
  Controversy: 'bg-red-950/50 text-red-300 border-red-800/40',
  Leadership:  'bg-orange-950/50 text-orange-300 border-orange-800/40',
  Expansion:   'bg-emerald-950/50 text-emerald-300 border-emerald-800/40',
};

// Light-mode fallbacks
const SIGNAL_COLORS_LIGHT: Record<string, string> = {
  Launch:      'dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/40 bg-blue-50 text-blue-700 border-blue-200',
  Campaign:    'dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/40 bg-purple-50 text-purple-700 border-purple-200',
  Partnership: 'dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800/40 bg-teal-50 text-teal-700 border-teal-200',
  Financials:  'dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800/40 bg-yellow-50 text-yellow-700 border-yellow-200',
  Controversy: 'dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/40 bg-red-50 text-red-700 border-red-200',
  Leadership:  'dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/40 bg-orange-50 text-orange-700 border-orange-200',
  Expansion:   'dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/40 bg-emerald-50 text-emerald-700 border-emerald-200',
};

type Props = {
  brandId: CompetitorId;
  brandName: string;
  isPublic: boolean;
  articles: Article[];
  intel: BrandIntel | undefined;
  locale?: 'en' | 'es' | 'da';
  basePath: string;
};

/** Returns initials from a brand name for the monogram circle */
function monogram(name: string): string {
  const words = name.replace(/[&.]/g, '').trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function BrandProfileCard({
  brandId,
  brandName,
  isPublic,
  articles,
  intel,
  locale = 'en',
  basePath,
}: Props) {
  if (articles.length === 0 && !intel?.narrative) return null;

  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const recentArticles = articles.filter(
    a => (a.published_at || a.ingested_at || '') >= fourWeeksAgo
  );
  const bigMoment = recentArticles[0] ?? articles[0];
  const signalFeed = articles.filter(a => a.url !== bigMoment?.url).slice(0, 5);
  const initials = monogram(brandName);

  return (
    <article
      className="group relative border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-[border-color] duration-300 hover:border-[var(--color-accent)]/40"
    >
      {/* Gold top border — draws on hover */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-400 ease-out"
        style={{ background: 'var(--color-accent)', transitionDuration: '350ms' }}
        aria-hidden
      />

      {/* Card header */}
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <div className="flex items-start justify-between gap-4">
          {/* Monogram + name block */}
          <div className="flex items-center gap-3">
            {/* Monogram circle */}
            <div
              className="shrink-0 w-9 h-9 rounded-full border border-[var(--color-accent)]/30 flex items-center justify-center font-display font-semibold select-none"
              style={{
                background: 'var(--color-accent-light)',
                color: 'var(--color-accent)',
                fontSize: '0.75rem',
                letterSpacing: '0.05em',
              }}
              aria-hidden
            >
              {initials}
            </div>
            <div>
              <h2
                className="font-display font-semibold text-[1.2rem] leading-tight text-[var(--color-text-primary)] tracking-[-0.01em]"
              >
                {brandName}
              </h2>
              <FinancialPulse financials={intel?.financials ?? null} isPublic={isPublic} />
            </div>
          </div>

          {/* Articles link badge */}
          {articles.length > 0 && (
            <a
              href={`${basePath}?brand=${brandId}`}
              className="shrink-0 font-ibm-mono text-[10px] tracking-[0.1em] text-[var(--color-accent)] hover:text-[var(--color-text-primary)] transition-colors duration-200 whitespace-nowrap border border-[var(--color-accent)]/25 px-2 py-0.5 rounded-sm hover:border-[var(--color-accent)]/60"
            >
              {articles.length} ART{articles.length !== 1 ? 'S' : ''}
            </a>
          )}
        </div>

        {/* Strategic narrative */}
        {intel?.narrative && (
          <p className="text-[0.875rem] text-[var(--color-text-secondary)] mt-3.5 leading-relaxed">
            {intel.narrative}
          </p>
        )}
      </div>

      {/* Big moment — featured top story */}
      {bigMoment && (
        <div className="px-5 pt-4 pb-0">
          <ArticleCard
            title={bigMoment.title}
            url={bigMoment.url}
            source={bigMoment.source}
            date={bigMoment.published_at}
            summary={undefined}
            badges={bigMoment.signalTag ? [bigMoment.signalTag] : undefined}
            locale={locale}
            translations={bigMoment.translations}
            aiSummaryLabel="AI summary"
            variant="featured"
          />
        </div>
      )}

      {/* Signal feed — compact rows */}
      {signalFeed.length > 0 && (
        <div className="px-5 pb-4">
          <p className="intel-section-label mb-2 pt-1">Recent signals</p>
          <ul>
            {signalFeed.map(article => (
              <li
                key={article.url}
                className="intel-article-row flex items-start gap-2.5 py-2.5 border-b border-[var(--color-border)]/60 last:border-b-0"
              >
                {article.signalTag && (
                  <span
                    className={`shrink-0 mt-0.5 font-ibm-mono text-[9px] font-semibold px-1.5 py-0.5 rounded-sm border whitespace-nowrap tracking-[0.05em] ${
                      SIGNAL_COLORS_LIGHT[article.signalTag] ?? 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
                    }`}
                  >
                    {article.signalTag.toUpperCase()}
                  </span>
                )}
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-[13px] font-sans text-[var(--color-text-primary)] hover:text-[var(--color-accent)] leading-snug line-clamp-2 transition-colors duration-150"
                >
                  {article.title}
                </a>
                {(article.published_at || article.ingested_at) && (
                  <span className="shrink-0 ml-2 mt-0.5 font-ibm-mono text-[10px] text-[var(--color-text-secondary)] whitespace-nowrap">
                    {new Date(article.published_at || article.ingested_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
