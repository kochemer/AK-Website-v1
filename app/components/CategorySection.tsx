'use client';

import { useRef, useState, useEffect } from 'react';
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
  categoryKey?: string;
};

export default function CategorySection({
  title,
  count,
  articles,
  variant = 'default',
  id,
  locale = 'en',
  emptyTitle = 'Coverage light this week',
  emptyDesc = 'This is a curated weekly selection. Not every category will have articles every week.',
  emptyCta = 'Suggest a source',
  aiSummaryLabel = 'AI summary',
  categoryKey,
}: CategorySectionProps) {
  const isGrid = variant === 'grid';
  const headerRef = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) { setRevealed(true); return; }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id={id}
      className={isGrid
        ? "scroll-mt-20 sm:scroll-mt-24 relative pb-16 md:pb-20"
        : "mb-0 pb-16 md:pb-20 border-b border-[var(--color-border)] last:border-b-0 last:pb-0 last:mb-0 scroll-mt-20 sm:scroll-mt-24 relative py-16 md:py-20"
      }
    >
      {/* Editorial frontispiece header */}
      <header
        ref={headerRef}
        className={`mb-10 pt-16 border-t border-[var(--color-accent)] transition-all duration-[600ms] ease-out ${
          revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-accent)] font-sans mb-4">
          This Week
        </p>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-serif font-normal text-[2.75rem] leading-none tracking-[-0.02em] text-[var(--color-text-primary)]">
            {title}
          </h2>
          {(count > 0 || articles.length > 0) && (
            <span className="font-sans text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-secondary)] pb-1 shrink-0">
              {count} articles · {articles.length} selected
            </span>
          )}
        </div>
        <hr className="mt-5 border-[var(--color-border)]" />
      </header>

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
          <div className="md:col-span-2 bg-[var(--color-surface)] rounded-lg border border-dashed border-[var(--color-border)] text-center py-6 sm:py-8 md:py-10 lg:py-12 px-3 sm:px-4 md:px-6">
            <div className="font-medium text-card-title text-[var(--color-text-secondary)] mb-1.5 sm:mb-2">
              {emptyTitle}
            </div>
            <div className="text-body text-[var(--color-text-secondary)] mb-3 sm:mb-4">
              {emptyDesc}
            </div>
            {isGrid && (
              <Link
                href="/feedback"
                className="text-meta text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline"
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
