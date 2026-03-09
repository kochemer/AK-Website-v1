import ArticleCard from './ArticleCard';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n/types';

type Article = {
  id: string;
  title: string;
  url: string;
  source: string;
  published_at?: string;
  date?: string;
  aiSummary?: string | null;
  translations?: {
    da?: { title?: string; summary?: string };
    es?: { title?: string; summary?: string };
  };
};

type CategorySectionProps = {
  title: string;
  description?: string;
  count: number;
  articles: Article[];
  rankingLabel?: string;
  variant?: 'default' | 'grid';
  id?: string;
  locale?: Locale;
  emptyTitle?: string;
  emptyDesc?: string;
  emptyCta?: string;
  countLabel?: string;
  aiSummaryLabel?: string;
  /** Topic/category key for analytics (e.g. AI_and_Strategy) */
  categoryKey?: string;
};

export default function CategorySection({
  title,
  description,
  count,
  articles,
  rankingLabel,
  variant = 'default',
  id,
  locale = 'en',
  emptyTitle = 'Coverage light this week',
  emptyDesc = 'This is a curated weekly selection. Not every category will have articles every week.',
  emptyCta = 'Suggest a source',
  countLabel = '# of articles processed',
  aiSummaryLabel = 'AI summary',
  categoryKey,
}: CategorySectionProps) {
  const isGrid = variant === 'grid';
  
  return (
    <section 
      id={id}
      className={isGrid 
        ? "bg-[var(--color-surface)] rounded-lg border border-gray-100 p-6 sm:p-7 md:p-8 scroll-mt-20 sm:scroll-mt-24 relative py-16 md:py-20" 
        : "mb-0 pb-16 md:pb-20 border-b border-gray-200 last:border-b-0 last:pb-0 last:mb-0 scroll-mt-20 sm:scroll-mt-24 relative py-16 md:py-20"
      }
    >
      {/* Gold rule above heading */}
      <div className="w-full h-px bg-[var(--color-accent)]/30 mb-6" aria-hidden="true" />
      {/* Section Header: Title, optional description, inline article count */}
      <div className="mb-8">
        <h2 className="text-section font-bold text-gray-900 pr-2">{title}</h2>
        {description && (
          <p className="text-body text-gray-600 mt-1.5 sm:mt-2 italic pr-2">{description}</p>
        )}
        {(count > 0 || articles.length > 0) && (
          <p className="text-meta text-[var(--color-text-secondary)] mt-2 opacity-70">
            {count} articles · {articles.length} selected
          </p>
        )}
      </div>

      {/* Articles List: first = Top Story card (full width), rest in 2-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {articles.length > 0 ? (
          <>
            <div className="md:col-span-2">
              <ArticleCard
                variant="featured"
                key={articles[0].id}
                title={articles[0].title}
                url={articles[0].url}
                source={articles[0].source}
                date={articles[0].date || articles[0].published_at || ''}
                summary={articles[0].aiSummary}
                locale={locale}
                translations={articles[0].translations}
                aiSummaryLabel={aiSummaryLabel}
                article_id={articles[0].id}
                article_rank={1}
                category={categoryKey}
              />
            </div>
            {articles.slice(1).map((article, index) => (
              <ArticleCard
                key={article.id}
                title={article.title}
                url={article.url}
                source={article.source}
                date={article.date || article.published_at || ''}
                summary={article.aiSummary}
                locale={locale}
                translations={article.translations}
                aiSummaryLabel={aiSummaryLabel}
                article_id={article.id}
                article_rank={index + 2}
                category={categoryKey}
              />
            ))}
          </>
        ) : (
          <div className="md:col-span-2 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center py-6 sm:py-8 md:py-10 lg:py-12 px-3 sm:px-4 md:px-6">
            <div className="font-medium text-card-title text-gray-600 mb-1.5 sm:mb-2">
              {emptyTitle}
            </div>
            <div className="text-body text-gray-500 mb-3 sm:mb-4">
              {emptyDesc}
            </div>
            {isGrid && (
              <Link
                href="/feedback"
                className="text-meta text-gray-600 hover:text-gray-800 underline"
              >
                {emptyCta}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
