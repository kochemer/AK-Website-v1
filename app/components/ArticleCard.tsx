'use client';

import { formatDisplayDate } from '../../utils/formatDisplayDate';

type ArticleCardProps = {
  title: string;
  url: string;
  source?: string;
  date?: string;
  summary?: string | null;
  badges?: string[];
};

export default function ArticleCard({
  title,
  url,
  source,
  date,
  summary,
  badges,
}: ArticleCardProps) {
  // Clean summary text (remove AI-Generated Summary prefix if present)
  const cleanSummary = summary
    ?.replace(/^AI-Generated Summary:\s*/i, '')
    .replace(/^AI-generated summary:\s*/i, '')
    .trim() || null;

  // Format date for display
  const displayDate = date ? formatDisplayDate(date) : null;

  return (
    <div className="block w-full bg-white pb-3 sm:pb-4 md:pb-5 border-b border-gray-100">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block pt-3 sm:pt-4 md:pt-5 no-underline text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {/* Title */}
        <div className="mb-1 sm:mb-1.5 font-semibold text-sm sm:text-base md:text-lg leading-snug sm:leading-tight text-blue-800 line-clamp-3">
          {title}
        </div>

        {/* Meta row: Source • Date (only render if source or date exists) */}
        {(source || displayDate) && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base text-gray-600 mb-1.5 sm:mb-2">
            {source && <span className="break-all">{source}</span>}
            {source && displayDate && (
              <span className="text-gray-400 font-light hidden sm:inline">•</span>
            )}
            {displayDate && <span>{displayDate}</span>}
            {badges && badges.length > 0 && (
              <>
                <span className="text-gray-400 font-light hidden sm:inline">•</span>
                <div className="flex gap-1 sm:gap-1.5 flex-wrap">
                  {badges.map((badge, idx) => (
                    <span
                      key={idx}
                      className="px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs bg-gray-100 text-gray-700 rounded"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Badges row (only render if meta row is hidden and badges exist) */}
        {!(source || displayDate) && badges && badges.length > 0 && (
          <div className="flex gap-1 sm:gap-1.5 flex-wrap mb-1">
            {badges.map((badge, idx) => (
              <span
                key={idx}
                className="px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs bg-gray-100 text-gray-700 rounded"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </a>

      {/* Optional summary - responsive clamp */}
      {cleanSummary && (
        <div className="mt-2 sm:mt-2.5">
          <div
            className="text-xs sm:text-sm md:text-base text-gray-600 bg-gray-50 border-l-2 border-gray-300 rounded px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 line-clamp-2 sm:line-clamp-3"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            <span className="text-xs sm:text-sm md:text-base text-gray-600">AI summary: </span>{cleanSummary}
          </div>
        </div>
      )}
    </div>
  );
}

