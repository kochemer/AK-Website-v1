import { promises as fs } from 'fs';
import path from 'path';
import { DateTime } from 'luxon';
import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import DigestClientView from './components/DigestClientView';
import CategoryCard from './components/CategoryCard';
import PodcastPlayer from './components/PodcastPlayer';
import StatsBar from './components/StatsBar';
import TopNSelector from './components/TopNSelector';
import { TopicKey } from '@/lib/utils/topicNames';
import { formatDate, formatDateRange, formatDateTime, formatIssueLine } from '@/lib/utils/formatDate';
import { getCurrentDigestWeek } from '@/lib/utils/getCurrentDigestWeek';
import { getSiteUrl } from '@/lib/utils/siteUrl';
import { CATEGORY_COLORS } from '@/lib/constants/categoryColors';
import type { WeeklyDigest } from '@/lib/types';

// Get site URL once at module load
const siteUrl = getSiteUrl();

// Runtime assertion in production: ensure canonical URL is correct
if (process.env.NODE_ENV === 'production') {
  const canonical = `${siteUrl}/`;
  if (!canonical.startsWith(siteUrl)) {
    console.error(`[Metadata Error] Homepage canonical URL does not start with siteUrl: ${canonical} (siteUrl: ${siteUrl})`);
  }
  if (!canonical.startsWith('https://')) {
    console.error(`[Metadata Error] Homepage canonical URL is not absolute HTTPS: ${canonical}`);
  }
  if (canonical.includes('vercel.app')) {
    console.error(`[Metadata Error] Homepage canonical URL contains vercel.app domain: ${canonical}`);
  }
}

export const metadata: Metadata = {
  title: 'Weekly AI, Ecommerce & Luxury Industry Digest',
  description: 'A weekly curated digest covering AI & strategy, ecommerce and retail technology, luxury and jewellery industry news. Updated every week.',
  alternates: {
    canonical: `${siteUrl}/`,
  },
  openGraph: {
    title: 'Weekly AI, Ecommerce & Luxury Industry Digest',
    description: 'A weekly curated digest covering AI & strategy, ecommerce and retail technology, luxury and jewellery industry news. Updated every week.',
    images: [`${siteUrl}/og-default.svg`],
  },
  twitter: {
    title: 'Weekly AI, Ecommerce & Luxury Industry Digest',
    description: 'A weekly curated digest covering AI & strategy, ecommerce and retail technology, luxury and jewellery industry news. Updated every week.',
    images: [`${siteUrl}/og-default.svg`],
  },
};

async function loadDigest(weekLabel: string): Promise<WeeklyDigest | null> {
  try {
    const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
    const raw = await fs.readFile(digestPath, 'utf-8');
    return JSON.parse(raw) as WeeklyDigest;
  } catch (err: any) {
    // File not found is expected if digest hasn't been generated yet
    if (err?.code === 'ENOENT') {
      // Silently return null - this is expected behavior
      return null;
    }
    // Log other errors (permissions, parse errors, etc.)
    console.error(`Failed to load digest for ${weekLabel}:`, err);
    return null;
  }
}

type PodcastMetadata = {
  week: string;
  audioPath: string;
  model: string;
  voice: string;
  generatedAt: string;
  duration?: number;
};

async function loadLatestPodcast(): Promise<PodcastMetadata | null> {
  try {
    const weekLabel = getCurrentDigestWeek();
    const podcastPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'podcast.json');
    const raw = await fs.readFile(podcastPath, 'utf-8');
    return JSON.parse(raw) as PodcastMetadata;
  } catch {
    // Fail silently if podcast doesn't exist
    return null;
  }
}

async function loadPodcastForWeek(weekLabel: string): Promise<PodcastMetadata | null> {
  try {
    const podcastPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'podcast.json');
    const raw = await fs.readFile(podcastPath, 'utf-8');
    return JSON.parse(raw) as PodcastMetadata;
  } catch {
    // Fail silently if podcast doesn't exist
    return null;
  }
}

// Category UI meta data (title, short desc, topicKey, N)
// Ordered for display: Ecommerce, Jewellery, AI, Luxury
const CATEGORY_CARDS: Array<{
  key: TopicKey;
  color: string;
  title: string;
  desc: string;
  cardDesc: string;
  countBy: string;
  topInfo: string;
  anchorId: string;
}> = [
  {
    key: 'Ecommerce_Retail_Tech',
    color: CATEGORY_COLORS.Ecommerce_Retail_Tech,
    title: 'Ecommerce & Retail Tech',
    desc: 'Breakthroughs and trends shaping online commerce, retail, and emerging tech.',
    cardDesc: 'Digital commerce, retail innovation, DTC trends',
    countBy: 'EcommerceRetail',
    topInfo: 'Top 7 articles by recency',
    anchorId: 'ecommerce-retail-tech',
  },
  {
    key: 'Jewellery_Industry',
    color: CATEGORY_COLORS.Jewellery_Industry,
    title: 'Jewellery Industry',
    desc: 'Key updates and articles across jewellery brands, trade, and supply chain.',
    cardDesc: 'Market moves, brand strategy, trade insights',
    countBy: 'Jewellery',
    topInfo: 'Top 7 articles by recency',
    anchorId: 'jewellery-industry',
  },
  {
    key: 'AI_and_Strategy',
    color: CATEGORY_COLORS.AI_and_Strategy,
    title: 'Artificial Intelligence News',
    desc: 'The latest advances and strategies in artificial intelligence and business transformation.',
    cardDesc: 'AI news, strategy, and business transformation',
    countBy: 'AIStrategy',
    topInfo: 'Top 7 articles by relevance',
    anchorId: 'ai-strategy',
  },
  {
    key: 'Luxury_and_Consumer',
    color: CATEGORY_COLORS.Luxury_and_Consumer,
    title: 'Fashion & Luxury',
    desc: 'Innovations and changes in luxury and wider consumer products, experiences, and brands.',
    cardDesc: 'Luxury brands, consumer trends, fashion',
    countBy: 'LuxuryConsumer',
    topInfo: 'Top 7 articles by recency',
    anchorId: 'luxury-consumer',
  },
];


export default async function Home() {
  // Use shared utility to get current digest week (synchronized with email digest page)
  const weekLabel = getCurrentDigestWeek();
  const digest = await loadDigest(weekLabel);
  const podcast = await loadPodcastForWeek(weekLabel);

  // HERO section (always present)
  return (
    <main className="w-full" style={{
      minHeight: '100vh',
      fontFamily: 'system-ui, Arial, sans-serif',
      background: 'var(--color-bg)',
    }}>

      {/* MAGAZINE COVER HERO (Concept A) — full-bleed image, overlaid masthead */}
      <section className="relative w-full min-h-[60vh] sm:min-h-[70vh] md:min-h-[80vh] overflow-hidden" style={{ zIndex: 0 }}>
        {/* Cover image — full bleed, anchor to bottom so top crops and bottom is visible */}
        {digest?.coverImageUrl ? (
          <img
            src={digest.coverImageUrl}
            alt={digest.coverImageAlt || `Weekly digest cover for ${digest?.weekLabel || 'current week'}`}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: 'bottom' }}
          />
        ) : (
          <div
            className="absolute inset-0 w-full h-full"
            style={{ background: 'linear-gradient(120deg, var(--color-deep) 50%, var(--color-accent) 100%)' }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
        {/* Masthead */}
        <div className="absolute top-0 left-0 right-0 pt-8 md:pt-12 px-6 md:px-12 z-10">
          <h1 className="text-white font-serif text-hero tracking-[0.2em] uppercase font-bold">
            Luxury Intelligence
          </h1>
          <div className="w-16 h-px bg-[var(--color-accent)] mt-3 md:mt-4" aria-hidden="true" />
          {weekLabel && (
            <p className="text-white/70 text-meta tracking-[0.3em] uppercase mt-2">
              {formatIssueLine(weekLabel, digest?.startISO)}
            </p>
          )}
        </div>
        {/* Bottom — lead line */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-10">
          {digest?.oneSentenceSummary ? (
            <p className="font-serif italic text-card-title text-white max-w-2xl" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              {digest.oneSentenceSummary}
            </p>
          ) : null}
        </div>
      </section>

      {/* Tagline — below hero as subtle subtitle */}
      <div className="relative z-20 -mt-6 md:-mt-8 px-4 sm:px-6 md:px-8 text-center">
        <p className="text-body text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          Weekly intelligence across AI, ecommerce, luxury, and jewellery.
        </p>
      </div>

      {/* PANELS SECTION */}
      <section className="relative z-20 -mt-2 pt-2">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-5 md:px-6">
          {/* Stats bar: article count between hero and category nav */}
          {digest && (
            <StatsBar
              totalArticles={digest.totals.total}
              secondaryLine={`${digest.totals.total} selected · 4 categories`}
            />
          )}
          {/* Podcast + stats on cream */}
          <div className="bg-[var(--color-bg)] rounded-t-xl md:rounded-t-2xl border border-b-0 border-t border-t-[var(--color-accent)] border-black/5 p-6 sm:p-6 md:p-8 lg:p-10">
          {!digest ? (
            <div style={{
              maxWidth: 520,
              margin: '3.5rem auto 0 auto',
              padding: '2.5rem 1.5rem',
              background: '#fff1e2',
              borderRadius: 10,
              border: '1.5px dashed #ffdfa9',
              fontSize: '1.1rem',
              color: '#913d00',
              textAlign: 'center',
              boxShadow: '0 2px 12px 0 rgba(200,170,100,0.04)'
            }}>
              <h2 style={{margin: '0 0 1rem 0', fontSize: '1.6rem', fontWeight: 600}}>Digest not built yet</h2>
              <p style={{marginBottom:'1.1rem'}}>No latest digest found for this week.</p>
              <div style={{marginBottom:'1.5rem'}}>
                <span style={{
                  background: '#fff4ca',
                  color: '#905e19',
                  fontFamily: 'monospace',
                  padding: '0.28rem 0.46rem',
                  borderRadius: '4px',
                  fontSize: '1.04rem',
                  display:'inline-block'
                }}>npx tsx scripts/buildWeeklyDigest.ts</span>
              </div>
            </div>
          ) : (
            <>
              {/* Podcast Player - At top of panel (cream band) */}
              {podcast && (
                <div className="mb-5 sm:mb-6 md:mb-8 pb-5 sm:pb-6 md:pb-8 border-b border-gray-200 dark:border-gray-700">
                  <PodcastPlayer
                    src={podcast.audioPath}
                    title="Weekly Luxury Intelligence · ~12 minutes"
                    description="Listen to this week's key ecommerce, jewellery & luxury stories"
                    durationSeconds={podcast.duration}
                  />
                </div>
              )}

              {/* THIS WEEK - Category cards + Top N */}
              <div className="mb-4 sm:mb-5 md:mb-6 pb-4 sm:pb-5 md:pb-6 border-b border-gray-200 dark:border-gray-700">
                <span className="text-meta font-medium uppercase tracking-widest text-[var(--color-accent)] block mb-4">
                  THIS WEEK
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {CATEGORY_CARDS.map((cat) => {
                    const byTopic = digest.totals?.byTopic as Record<string, number> | undefined;
                    const count = byTopic?.[cat.countBy] ?? 0;
                    return (
                      <CategoryCard
                        key={cat.key}
                        title={cat.title}
                        description={cat.cardDesc}
                        articleCount={count}
                        color={cat.color}
                        href={`#${cat.anchorId}`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center">
                    <Suspense fallback={<div className="h-4 w-20" />}>
                      <TopNSelector />
                    </Suspense>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-meta font-medium text-black/60">
                      {digest.totals.total}
                    </span>
                    <span className="text-meta text-black/40">
                      articles analysed this week
                    </span>
                  </div>
                </div>
              </div>

              {/* Article sections - white band */}
              <div className={`bg-white border-x border-b border-gray-200 px-6 sm:px-6 md:px-8 lg:px-10 py-16 md:py-20 ${!(digest.keyThemes?.length) && !digest.oneSentenceSummary ? 'rounded-b-xl md:rounded-b-2xl' : ''}`}>
              {/* CATEGORY SECTIONS UI - Client-side rendering with reactive TopN */}
              <Suspense fallback={
                <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {CATEGORY_CARDS.map(cat => (
                    <div key={cat.key} className="w-full">
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 md:p-7 h-64 animate-pulse" />
                    </div>
                  ))}
                </div>
              }>
                <DigestClientView digest={digest} categoryCards={CATEGORY_CARDS} variant="home" />
              </Suspense>
              </div>

              {/* Key Themes Summary (cream band) */}
              {(digest.keyThemes && digest.keyThemes.length > 0) || digest.oneSentenceSummary ? (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-[var(--color-bg)] rounded-b-xl md:rounded-b-2xl px-6 sm:px-6 md:px-8 lg:px-10 py-16 md:py-20">
                  <div className="text-center">
                    {digest.oneSentenceSummary && (
                      <p className="text-body text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 px-2">
                        {digest.oneSentenceSummary}
                      </p>
                    )}
                    {digest.keyThemes && digest.keyThemes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
                        {digest.keyThemes.map((theme, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-meta font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
          </div>
        </div>
      </section>
    </main>
  );
}
