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
        ? "bg-white rounded-lg border border-gray-100 p-4 sm:p-5 md:p-7 scroll-mt-20 sm:scroll-mt-24 relative" 
        : "mb-8 sm:mb-10 md:mb-12 pb-8 sm:pb-10 md:pb-12 border-b border-gray-200 last:border-b-0 last:pb-0 last:mb-0 scroll-mt-20 sm:scroll-mt-24 relative"
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
          <span className="text-xs sm:text-xs font-medium text-gray-700">
            {count}
          </span>
          <span className="text-[10px] sm:text-[10px] text-gray-400 leading-tight mt-0.5 hidden sm:block">
            {countLabel}
          </span>
        </div>
      )}
      {/* Section Header: Title (left) */}
      <div className="mb-3 sm:mb-4 md:mb-5" style={{ paddingRight: count > 0 ? '3.5rem sm:4.5rem md:5rem' : '0' }}>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-tight pr-2">{title}</h2>
        {/* Optional Description */}
        {description && (
          <p className="text-sm sm:text-sm md:text-base text-gray-600 mt-1.5 sm:mt-2 leading-relaxed italic pr-2">{description}</p>
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
            <div className="font-medium text-sm sm:text-base md:text-lg text-gray-600 mb-1.5 sm:mb-2">
              {emptyTitle}
            </div>
            <div className="text-xs sm:text-sm md:text-base text-gray-500 mb-3 sm:mb-4">
              {emptyDesc}
            </div>
            {isGrid && (
              <Link 
                href="/feedback" 
                className="text-xs sm:text-sm md:text-base text-gray-600 hover:text-gray-800 underline"
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
