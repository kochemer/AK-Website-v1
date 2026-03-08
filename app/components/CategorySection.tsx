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
        ? "bg-white rounded-lg border border-gray-100 p-6 sm:p-7 md:p-8 scroll-mt-20 sm:scroll-mt-24 relative py-16 md:py-20" 
        : "mb-0 pb-16 md:pb-20 border-b border-gray-200 last:border-b-0 last:pb-0 last:mb-0 scroll-mt-20 sm:scroll-mt-24 relative py-16 md:py-20"
      }
    >
      {/* Count Badge - Absolute top right */}
      {count > 0 && (
        <div className="absolute top-0 right-0 flex flex-col items-end" style={{ 
          paddingTop: isGrid ? '1rem' : '0',
          paddingRight: isGrid ? '1rem sm:1.25rem md:1.75rem' : '0',
          top: '0',
          right: '0',
        }}>
          <span className="text-meta font-medium text-gray-700">
            {count}
          </span>
          <span className="text-meta text-gray-400 leading-tight mt-0.5 hidden sm:block">
            {countLabel}
          </span>
        </div>
      )}
      {/* Section Header: Title (left) - generous gap before first card */}
      <div className="mb-8" style={{ paddingRight: count > 0 ? '3.5rem sm:4.5rem md:5rem' : '0' }}>
        <h2 className="text-section font-bold text-gray-900 pr-2">{title}</h2>
        {/* Optional Description */}
        {description && (
          <p className="text-body text-gray-600 mt-1.5 sm:mt-2 italic pr-2">{description}</p>
        )}
      </div>

      {/* Articles List - 2-column grid on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {articles.length > 0 ? (
          articles.map((article, index) => (
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
              article_rank={index + 1}
              category={categoryKey}
            />
          ))
        ) : (
          <div className="bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center py-6 sm:py-8 md:py-10 lg:py-12 px-3 sm:px-4 md:px-6">
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
