import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import type { Metadata } from 'next';
import { formatDate } from '@/lib/utils/formatDate';
import { getCurrentDigestWeek } from '@/lib/utils/getCurrentDigestWeek';
import { getSiteUrl } from '@/lib/utils/siteUrl';
import type { EmailDigest } from '@/lib/types';

// Lazy evaluation for dev mode compatibility
const getSiteUrlLazy = () => getSiteUrl();

export const metadata: Metadata = {
  title: 'Email Digest – Weekly Intelligence',
  description: 'A single ranked list of the week\'s top articles with sharp insights for retail, luxury, and AI intelligence.',
  alternates: {
    canonical: `${getSiteUrlLazy()}/email-digest`,
  },
};

async function loadEmailDigest(weekLabel: string): Promise<EmailDigest | null> {
  try {
    const digestPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'email-digest.json');
    const raw = await fs.readFile(digestPath, 'utf-8');
    return JSON.parse(raw) as EmailDigest;
  } catch (err: any) {
    // File not found is expected if digest hasn't been generated yet
    if (err?.code === 'ENOENT') {
      // Silently return null - this is expected behavior
      return null;
    }
    // Log other errors (permissions, parse errors, etc.)
    console.error(`Failed to load email digest for ${weekLabel}:`, err);
    return null;
  }
}

export default async function EmailDigestPage() {
  // Use shared utility to get current digest week (synchronized with home page)
  const weekLabel = getCurrentDigestWeek();
  const digest = await loadEmailDigest(weekLabel);

  return (
    <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Email Digest
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          A single ranked list of the week&apos;s top articles with sharp insights for retail, luxury, and AI intelligence.
        </p>
      </div>

      {!digest ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-900 mb-2">
            Email digest not generated yet
          </h2>
          <p className="text-sm text-yellow-800 mb-4">
            No email digest found for week {weekLabel}.
          </p>
          <div className="bg-yellow-100 rounded p-3 font-mono text-sm text-yellow-900">
            npm run email-digest -- --week={weekLabel}
          </div>
        </div>
      ) : (
        <>
          {/* Week Header */}
          <div className="mb-6 pb-4 border-b border-gray-200">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              Week {digest.week}
            </h2>
            {digest.generatedAt && (
              <p className="text-xs sm:text-sm text-gray-500">
                Generated {formatDate(digest.generatedAt)}
              </p>
            )}
          </div>

          {/* Intro */}
          {digest.intro && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                {digest.intro}
              </p>
            </div>
          )}

          {/* Read One Thing */}
          {digest.readOneThing && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                Read One Thing
              </h3>
              <a
                href={digest.readOneThing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base sm:text-lg font-medium text-blue-800 hover:text-blue-900 hover:underline"
              >
                {digest.readOneThing.title}
              </a>
            </div>
          )}

          {/* Ranked List */}
          <div className="space-y-6 sm:space-y-8">
            {digest.items.map((item) => (
              <article
                key={item.rank}
                className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-sm sm:text-base font-bold text-gray-700">
                      {item.rank}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="mb-2 sm:mb-3">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base sm:text-lg md:text-xl font-semibold text-blue-800 hover:text-blue-900 hover:underline leading-tight"
                      >
                        {item.title}
                      </a>
                    </h3>

                    {/* Source */}
                    <p className="text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">
                      {item.source}
                    </p>

                    {/* Bullets */}
                    <ul className="space-y-1.5 sm:space-y-2">
                      {item.bullets.map((bullet, idx) => (
                        <li
                          key={idx}
                          className="text-sm sm:text-base text-gray-700 leading-relaxed flex items-start"
                        >
                          <span className="text-gray-400 mr-2 flex-shrink-0">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
