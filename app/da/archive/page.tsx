import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/utils/siteUrl';
import { formatDateRange } from '@/lib/utils/formatDate';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: 'Arkiv – Ugentlige AI og Luksus Brancheoversigter',
  description: 'Gennemse det komplette arkiv af ugentlige AI, ecommerce, luksus og smykkebrancheoversigter. Få adgang til alle tidligere kurerede intelligensoversigter og ugentlige resuméer.',
  alternates: {
    canonical: `${siteUrl}/da/archive`,
  },
  openGraph: {
    title: 'Arkiv – Ugentlige AI og Luksus Brancheoversigter',
    description: 'Gennemse det komplette arkiv af ugentlige AI, ecommerce, luksus og smykkebrancheoversigter. Få adgang til alle tidligere kurerede intelligensoversigter og ugentlige resuméer.',
    images: [`${siteUrl}/og-default.svg`],
  },
  twitter: {
    title: 'Arkiv – Ugentlige AI og Luksus Brancheoversigter',
    description: 'Gennemse det komplette arkiv af ugentlige AI, ecommerce, luksus og smykkebrancheoversigter. Få adgang til alle tidligere kurerede intelligensoversigter og ugentlige resuméer.',
    images: [`${siteUrl}/og-default.svg`],
  },
};

async function getAvailableDigests(): Promise<string[]> {
  try {
    const digestsDir = path.join(process.cwd(), 'data', 'digests');
    const files = await fs.readdir(digestsDir);
    const weekLabels = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .filter(label => /^\d{4}-W\d{1,2}$/.test(label))
      .sort((a, b) => {
        const [yearA, weekA] = a.split('-W').map(Number);
        const [yearB, weekB] = b.split('-W').map(Number);
        if (yearA !== yearB) return yearB - yearA;
        return weekB - weekA;
      });
    return weekLabels;
  } catch {
    return [];
  }
}

type WeekMeta = {
  dateRange: string | null;
  coverImageUrl?: string;
  coverImageAlt?: string;
  totalArticles: number;
  categoryCount: number;
  topArticleTitle?: string;
};

async function getWeekMeta(weekLabel: string): Promise<WeekMeta> {
  try {
    const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
    const raw = await fs.readFile(digestPath, 'utf-8');
    const digest = JSON.parse(raw);
    const dateRange = digest.startISO && digest.endISO ? formatDateRange(digest.startISO, digest.endISO) : null;
    const byTopic = digest.totals?.byTopic as Record<string, number> | undefined;
    const categoryCount = byTopic ? Object.values(byTopic).filter((v: number) => v > 0).length : 0;
    let topArticleTitle: string | undefined;
    const topics = digest.topics as Record<string, { top?: { title?: string }[] }> | undefined;
    if (topics) {
      for (const t of Object.values(topics)) {
        if (t?.top?.[0]?.title) { topArticleTitle = t.top[0].title; break; }
      }
    }
    return { dateRange, coverImageUrl: digest.coverImageUrl, coverImageAlt: digest.coverImageAlt, totalArticles: digest.totals?.total ?? 0, categoryCount, topArticleTitle };
  } catch {
    return { dateRange: null, totalArticles: 0, categoryCount: 0 };
  }
}

function extractIssueLabel(weekLabel: string): string {
  const match = weekLabel.match(/W(\d+)$/);
  return match ? `W${match[1].padStart(2, '0')}` : weekLabel;
}

export default async function ArchivePageDA() {
  const digests = await getAvailableDigests();

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-12 lg:px-16 py-16 md:py-20">
      <header className="mb-10 md:mb-14">
        <Link href="/da" className="text-[var(--color-accent)] hover:text-[var(--color-text-primary)] text-meta inline-block mb-4 transition-colors">
          ← Tilbage til start
        </Link>
        <h1 className="text-page-h1 font-bold mb-3 text-[var(--color-text-primary)]">
          Oversigtsarkiv
        </h1>
        <p className="text-body text-[var(--color-text-secondary)]">
          {digests.length} udgaver · AI, ecommerce, luksus og smykkebranchen.
        </p>
        <hr className="border-[var(--color-accent)] border-t-2 mt-6" />
      </header>

      {digests.length > 0 ? (
        <div>
          {await Promise.all(digests.map(async (weekLabel) => {
            const meta = await getWeekMeta(weekLabel);
            const issue = extractIssueLabel(weekLabel);
            return (
              <Link key={weekLabel} href={`/week/${weekLabel}`} className="group block py-6 border-b border-stone-200 first:pt-0 last:border-b-0 transition-colors hover:bg-[var(--color-accent-light)]/40 -mx-3 px-3 rounded-sm">
                <div className="flex items-start gap-4 md:gap-6">
                  {meta.coverImageUrl && (
                    <div className="flex-shrink-0 w-28 h-20 rounded-sm overflow-hidden bg-gray-100">
                      <img src={meta.coverImageUrl} alt={meta.coverImageAlt || `Omslag for ${weekLabel}`} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-card-title font-semibold text-[var(--color-text-primary)] leading-tight mb-1 group-hover:text-[var(--color-accent)] transition-colors">
                      {meta.dateRange || `Uge ${weekLabel}`}
                    </h2>
                    <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--color-accent)] font-sans font-semibold mb-2">Udgave {issue}</p>
                    {meta.topArticleTitle ? (
                      <p className="text-meta text-[var(--color-text-secondary)] line-clamp-1">{meta.topArticleTitle}</p>
                    ) : meta.totalArticles > 0 ? (
                      <p className="text-meta text-[var(--color-text-secondary)]">{meta.totalArticles} artikler · {meta.categoryCount} {meta.categoryCount === 1 ? 'kategori' : 'kategorier'}</p>
                    ) : null}
                    <span className="text-[var(--color-accent)] text-meta font-medium mt-2 inline-block group-hover:underline">Se oversigt →</span>
                  </div>
                  <span className="hidden md:block text-5xl font-light text-stone-200 font-serif select-none flex-shrink-0 leading-none pt-1" aria-hidden="true">{issue}</span>
                </div>
              </Link>
            );
          }))}
        </div>
      ) : (
        <div className="bg-[var(--color-accent-light)] border-l-4 border-[var(--color-accent)] p-5 rounded-sm">
          <p className="text-body text-[var(--color-text-primary)] mb-2 font-medium">Ingen oversigter endnu.</p>
          <p className="text-body text-[var(--color-text-secondary)]">
            Kør <code className="bg-gray-100 px-2 py-1 rounded text-meta font-mono">npx tsx scripts/buildWeeklyDigest.ts</code> for at oprette oversigter.
          </p>
        </div>
      )}
    </div>
  );
}
