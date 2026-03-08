'use client';

import { formatDisplayDate } from '@/lib/utils/formatDisplayDate';
import { track } from '@/lib/analytics';
import type { Locale } from '@/lib/i18n/types';

type ArticleCardProps = {
  title: string;
  url: string;
  source?: string;
  date?: string;
  summary?: string | null;
  badges?: string[];
  locale?: Locale;
  translations?: {
    da?: { title?: string; summary?: string };
    es?: { title?: string; summary?: string };
  };
  aiSummaryLabel?: string;
  /** Analytics: optional for article_click */
  article_id?: string;
  article_rank?: number;
  category?: string;
};

export default function ArticleCard({
  title,
  url,
  source,
  date,
  summary,
  badges,
  locale = 'en',
  translations,
  aiSummaryLabel = 'AI summary',
  article_id,
  article_rank,
  category,
}: ArticleCardProps) {
  const handleOutboundClick = () => {
    if (article_id != null || article_rank != null || category != null) {
      let source_domain: string | undefined;
      try {
        source_domain = new URL(url).hostname;
      } catch {
        source_domain = undefined;
      }
      track('article_click', {
        article_id,
        article_rank,
        category,
        source_domain,
      });
    }
  };

  // Resolve localized title and summary (fallback to English)
  const localizedTitle = (locale !== 'en' && translations?.[locale]?.title) || title;
  const localizedSummary = (locale !== 'en' && translations?.[locale]?.summary) || summary;

  // Clean summary text (remove AI-Generated Summary prefix if present)
  const cleanSummary = localizedSummary
    ?.replace(/^AI-Generated Summary:\s*/i, '')
    .replace(/^AI-generated summary:\s*/i, '')
    .trim() || null;

  // Format date for display
  const displayDate = date ? formatDisplayDate(date) : null;

  const linkProps = {
    href: url,
    target: '_blank',
    rel: 'noopener noreferrer' as const,
    onClick: handleOutboundClick,
  };

  return (
    <article
      className="group transition-all duration-200 py-6 border-b border-gray-200 pl-0 hover:pl-3 hover:border-l-2 hover:border-l-[var(--color-accent)] hover:bg-[var(--color-accent-light)] last:border-b-0"
    >
      {/* Source - top, uppercase muted */}
      {source && (
        <div className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)] mb-1.5">
          {source}
        </div>
      )}

      {/* Title - serif, prominent */}
      <a
        {...linkProps}
        className="block no-underline text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 rounded-sm"
      >
        <h3 className="font-serif text-xl font-semibold leading-tight text-[var(--color-text-primary)] mb-2 line-clamp-3 pr-1 hover:text-[var(--color-accent)] transition-colors">
          {localizedTitle}
        </h3>
      </a>

      {/* Summary - secondary, relaxed */}
      {cleanSummary && (
        <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3 line-clamp-4">
          <span className="font-medium">{aiSummaryLabel}: </span>
          {cleanSummary}
        </div>
      )}

      {/* Metadata row - date, relevance (badges) */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-secondary)]">
        {displayDate && <span className="whitespace-nowrap">{displayDate}</span>}
        {badges && badges.length > 0 && (
          <>
            {displayDate && <span aria-hidden>·</span>}
            <div className="flex gap-1.5 flex-wrap">
              {badges.map((badge, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded"
                >
                  {badge}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Read article → link - bottom right, visible on hover */}
      <div className="mt-3 flex justify-end">
        <a
          {...linkProps}
          className="text-sm text-[var(--color-accent)] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:underline focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 rounded px-1 -mr-1"
        >
          Read article →
        </a>
      </div>
    </article>
  );
}
