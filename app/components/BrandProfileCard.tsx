import type { Article } from '@/lib/types/article';
import type { BrandIntel } from '@/lib/utils/loadCompetitorIntel';
import type { CompetitorId } from '@/lib/constants/competitorBrands';
import ArticleCard from './ArticleCard';
import FinancialPulse from './FinancialPulse';

const SIGNAL_COLORS: Record<string, string> = {
  Launch: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300',
  Campaign: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300',
  Partnership: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300',
  Financials: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300',
  Controversy: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300',
  Leadership: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300',
  Expansion: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300',
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

  // Big moment: most recent article from last 4 weeks with signalTag, or just most recent
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const recentArticles = articles.filter(
    a => (a.published_at || a.ingested_at || '') >= fourWeeksAgo
  );
  const bigMoment = recentArticles[0] ?? articles[0];

  // Signal feed: last 5 articles (excluding big moment to avoid duplication)
  const signalFeed = articles
    .filter(a => a.url !== bigMoment?.url)
    .slice(0, 5);

  return (
    <article className="border border-[var(--color-border)] rounded-sm overflow-hidden bg-[var(--color-surface)]">
      {/* Card header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-serif text-[1.25rem] font-semibold text-[var(--color-text-primary)] leading-tight mb-1">
              {brandName}
            </h2>
            <FinancialPulse financials={intel?.financials ?? null} isPublic={isPublic} />
          </div>
          <a
            href={`${basePath}?brand=${brandId}`}
            className="text-[11px] tracking-[0.2em] uppercase text-[var(--color-accent)] hover:text-[var(--color-text-primary)] font-sans font-medium transition-colors whitespace-nowrap"
          >
            {articles.length} article{articles.length !== 1 ? 's' : ''} →
          </a>
        </div>

        {/* Strategic narrative */}
        {intel?.narrative && (
          <p className="text-body text-[var(--color-text-secondary)] mt-3 leading-relaxed">
            {intel.narrative}
          </p>
        )}
      </div>

      {/* Big moment */}
      {bigMoment && (
        <div className="px-5 pt-4 pb-0">
          <ArticleCard
            title={bigMoment.title}
            url={bigMoment.url}
            source={bigMoment.source}
            date={bigMoment.published_at}
            summary={bigMoment.aiSummary}
            badges={bigMoment.signalTag ? [bigMoment.signalTag] : undefined}
            locale={locale}
            translations={bigMoment.translations}
            aiSummaryLabel="AI summary"
            variant="featured"
          />
        </div>
      )}

      {/* Signal feed */}
      {signalFeed.length > 0 && (
        <div className="px-5">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--color-text-secondary)] font-sans font-semibold mb-0 pt-2">
            Recent signals
          </p>
          <ul>
            {signalFeed.map(article => (
              <li key={article.url} className="flex items-start gap-3 py-3 border-b border-[var(--color-border)] last:border-b-0">
                {article.signalTag && (
                  <span
                    className={`shrink-0 mt-0.5 text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap ${SIGNAL_COLORS[article.signalTag] ?? ''}`}
                  >
                    {article.signalTag}
                  </span>
                )}
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] text-[var(--color-text-primary)] hover:text-[var(--color-accent)] font-sans leading-snug line-clamp-2 transition-colors"
                >
                  {article.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
