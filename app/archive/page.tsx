/**
 * Archive page for weekly digests.
 * 
 * - Scans `data/digests` for weekly digest files (YYYY-W##.json format)
 * - Lists all available weekly digests in reverse chronological order
 * - Links to individual week pages at /week/[weekLabel]
 */

import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import { formatDateRange } from '@/lib/utils/formatDate';

async function getAvailableDigests(): Promise<string[]> {
  try {
    const digestsDir = path.join(process.cwd(), 'data', 'digests');
    const files = await fs.readdir(digestsDir);
    const weekLabels = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .filter(label => /^\d{4}-W\d{1,2}$/.test(label)) // Weekly format: YYYY-W##
      .sort((a, b) => {
        // Sort by year and week number
        const [yearA, weekA] = a.split('-W').map(Number);
        const [yearB, weekB] = b.split('-W').map(Number);
        if (yearA !== yearB) return yearB - yearA; // Newer years first
        return weekB - weekA; // Higher week numbers first
      });
    return weekLabels;
  } catch {
    return [];
  }
}

async function getWeekMeta(weekLabel: string): Promise<{ dateRange: string | null; coverImageUrl?: string; coverImageAlt?: string }> {
  try {
    const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
    const raw = await fs.readFile(digestPath, 'utf-8');
    const digest = JSON.parse(raw);
    const dateRange = digest.startISO && digest.endISO ? formatDateRange(digest.startISO, digest.endISO) : null;
    return {
      dateRange,
      coverImageUrl: digest.coverImageUrl,
      coverImageAlt: digest.coverImageAlt,
    };
  } catch {
    return { dateRange: null };
  }
}

export default async function ArchivePage() {
  const weekLabels = await getAvailableDigests();

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-20">
      <header className="mb-8 md:mb-12">
        <h1 className="text-page font-bold mb-4 text-gray-900">
          Weekly Digest Archive
        </h1>
        <p className="text-body text-gray-600 mb-6">
          Browse all available weekly digests covering AI, ecommerce, luxury, and jewellery industry news.
        </p>
        <Link 
          href="/" 
          className="text-blue-600 hover:text-blue-800 underline inline-block"
        >
          ← Back to Home
        </Link>
      </header>

      {weekLabels.length > 0 ? (
        <div>
          <p className="text-body text-gray-600 mb-6">
            Available weekly digests ({weekLabels.length}):
          </p>
          <div className="grid gap-4 md:gap-6">
            {await Promise.all(weekLabels.map(async (weekLabel) => {
              const meta = await getWeekMeta(weekLabel);
              return (
                <Link
                  key={weekLabel}
                  href={`/week/${weekLabel}`}
                  className="block p-4 md:p-6 bg-[var(--color-surface)] border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {meta.coverImageUrl && (
                      <div className="flex-shrink-0 w-full md:w-32 h-40 md:h-24 rounded-md overflow-hidden bg-gray-100">
                        <img
                          src={meta.coverImageUrl}
                          alt={meta.coverImageAlt || `Cover for ${weekLabel}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="text-card-title font-semibold text-gray-900 mb-1">
                        Week {weekLabel}
                      </h2>
                      {meta.dateRange && (
                        <p className="text-meta text-gray-600">
                          {meta.dateRange}
                        </p>
                      )}
                    </div>
                    <span className="text-blue-600 text-body font-medium shrink-0">
                      View digest →
                    </span>
                  </div>
                </Link>
              );
            }))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 md:p-8">
          <p className="text-body text-gray-600 mb-4">
            No weekly digests available yet.
          </p>
          <p className="text-body text-gray-600">
            Run <code className="bg-gray-100 px-2 py-1 rounded text-meta font-mono">npx tsx scripts/buildWeeklyDigest.ts --week=YYYY-W##</code> to create digests.
          </p>
        </div>
      )}
    </div>
  );
}
