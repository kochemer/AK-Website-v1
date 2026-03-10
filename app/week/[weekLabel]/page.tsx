import { Suspense } from 'react';
import { promises as fs } from 'fs';
import path from 'path';
import { DateTime } from 'luxon';
import Link from 'next/link';
import type { Metadata } from 'next';
import DigestClientView from '../../components/DigestClientView';
import CategoryCardGrid from '../../components/CategoryCardGrid';
import PodcastPlayer from '../../components/PodcastPlayer';
import StatsBar from '../../components/StatsBar';
import AnalyticsDigestView from '../../components/AnalyticsDigestView';
import TopNSelector from '../../components/TopNSelector';
import ScrollProgressBar from '../../components/ScrollProgressBar';
import JsonLd from '../../components/JsonLd';
import Breadcrumbs from '../../components/Breadcrumbs';
import { getTopicTotalsDisplayName, TopicKey } from '@/lib/utils/topicNames';
import { formatDate, formatDateRange, formatDateTime } from '@/lib/utils/formatDate';
import { getSelectedArticleCount, formatStatsSecondaryLine } from '@/lib/utils/digestStats';
import { getSiteUrl } from '@/lib/utils/siteUrl';
import { CATEGORY_COLORS } from '@/lib/constants/categoryColors';
import type { WeeklyDigest } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ weekLabel: string }> }): Promise<Metadata> {
  const { weekLabel } = await params;
  const siteUrl = getSiteUrl(); // Call inside function for dev mode compatibility
  
  // Load digest to get cover image if available
  const digest = await loadDigest(weekLabel);
  const ogImage = digest?.coverImageUrl 
    ? `${siteUrl}${digest.coverImageUrl}`
    : `${siteUrl}/og-default.svg`;
  
  return {
    title: `Week ${weekLabel} – AI, Ecommerce & Luxury Industry Digest`,
    description: `Curated overview of the most relevant AI, ecommerce, luxury and jewellery industry news for week ${weekLabel}. Handpicked articles with AI summaries.`,
    alternates: {
      canonical: `${siteUrl}/week/${weekLabel}`,
    },
    openGraph: {
      title: `Week ${weekLabel} – AI, Ecommerce & Luxury Industry Digest`,
      description: `Curated overview of the most relevant AI, ecommerce, luxury and jewellery industry news for week ${weekLabel}. Handpicked articles with AI summaries.`,
      images: [ogImage],
    },
    twitter: {
      title: `Week ${weekLabel} – AI, Ecommerce & Luxury Industry Digest`,
      description: `Curated overview of the most relevant AI, ecommerce, luxury and jewellery industry news for week ${weekLabel}. Handpicked articles with AI summaries.`,
      images: [ogImage],
    },
  };
}


async function loadDigest(weekLabel: string): Promise<WeeklyDigest | null> {
  try {
    const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
    const raw = await fs.readFile(digestPath, 'utf-8');
    return JSON.parse(raw) as WeeklyDigest;
  } catch {
    return null;
  }
}

/**
 * Get all available week labels from digest files
 * Returns sorted array of week labels (YYYY-W## format only)
 */
async function getAvailableWeeks(): Promise<string[]> {
  try {
    const digestsDir = path.join(process.cwd(), 'data', 'digests');
    const files = await fs.readdir(digestsDir);
    
    // Filter for week format (YYYY-W##) and extract week labels
    // Pattern matches: 2025-W52.json, 2026-W01.json, etc.
    const weekLabels = files
      .filter(file => {
        // Match YYYY-W##.json where ## is 1-2 digits
        const matches = /^(\d{4})-W(\d{1,2})\.json$/.test(file);
        return matches;
      })
      .map(file => file.replace('.json', ''))
      .sort((a, b) => {
        // Sort chronologically: compare year first, then week number
        const [yearA, weekA] = a.split('-W').map(Number);
        const [yearB, weekB] = b.split('-W').map(Number);
        
        if (yearA !== yearB) {
          return yearA - yearB;
        }
        return weekA - weekB;
      });
    
    return weekLabels;
  } catch (err) {
    console.error('[Week Navigation] Error getting available weeks:', err);
    return [];
  }
}

/**
 * Find previous and next week labels for a given week
 */
async function getWeekNavigation(weekLabel: string): Promise<{
  previousWeek: string | null;
  nextWeek: string | null;
}> {
  try {
    const availableWeeks = await getAvailableWeeks();
    const currentIndex = availableWeeks.indexOf(weekLabel);
    
    if (currentIndex === -1) {
      // Week not found in available weeks
      return { previousWeek: null, nextWeek: null };
    }
    
    return {
      previousWeek: currentIndex > 0 ? availableWeeks[currentIndex - 1] : null,
      nextWeek: currentIndex < availableWeeks.length - 1 ? availableWeeks[currentIndex + 1] : null,
    };
  } catch (err) {
    console.error('[Week Navigation] Error getting week navigation:', err);
    return { previousWeek: null, nextWeek: null };
  }
}

export default async function WeekPage({ 
  params
}: { 
  params: Promise<{ weekLabel: string }>;
}) {
  const { weekLabel } = await params;
  
  // Validate format
  if (!/^\d{4}-W\d{1,2}$/.test(weekLabel)) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <h1 className="text-page font-bold mb-4 text-gray-900">Invalid Week Format</h1>
        <p className="text-body text-gray-600 mb-8">
          The week label "{weekLabel}" is not valid. Expected format: YYYY-W## (e.g., 2025-W52).
        </p>
        <div className="flex gap-4">
          <Link href="/archive" className="text-blue-600 hover:text-blue-800 underline">
            ← Archive
          </Link>
          <Link href="/" className="text-blue-600 hover:text-blue-800 underline">
            Home
          </Link>
        </div>
      </div>
    );
  }

  const digest = await loadDigest(weekLabel);
  const { previousWeek, nextWeek } = await getWeekNavigation(weekLabel);

  // Load podcast for this week
  type PodcastMetadata = {
    week: string;
    audioPath: string;
    model: string;
    voice: string;
    generatedAt: string;
    duration?: number;
  };

  let podcast: PodcastMetadata | null = null;
  try {
    const podcastPath = path.join(process.cwd(), 'data', 'weeks', weekLabel, 'podcast.json');
    const raw = await fs.readFile(podcastPath, 'utf-8');
    podcast = JSON.parse(raw) as PodcastMetadata;
  } catch {
    // Podcast doesn't exist, that's fine
  }

  if (!digest) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <h1 className="text-page font-bold mb-4 text-gray-900">Digest Not Found</h1>
        <p className="text-body text-gray-600 mb-4">
          The digest for {weekLabel} has not been built yet.
        </p>
        <p className="text-body text-gray-600 mb-8">
          Run: <code className="bg-gray-100 px-2 py-1 rounded text-meta font-mono">npx tsx scripts/buildWeeklyDigest.ts --week={weekLabel}</code>
        </p>
        <div className="flex gap-4">
          <Link href="/archive" className="text-blue-600 hover:text-blue-800 underline">
            ← Archive
          </Link>
          <Link href="/" className="text-blue-600 hover:text-blue-800 underline">
            Home
          </Link>
        </div>
      </div>
    );
  }

  const dateRange = formatDateRange(digest.startISO, digest.endISO);
  const siteUrl = getSiteUrl(); // Get site URL for JSON-LD schemas

  // Build CollectionPage JSON-LD schema
  const collectionPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Week ${digest.weekLabel} – Weekly Digest`,
    url: `${siteUrl}/week/${digest.weekLabel}`,
    isPartOf: {
      "@type": "WebSite",
      name: "Luxury Intelligence",
      url: siteUrl,
    },
    about: [
      { "@type": "Thing", name: "AI & Strategy" },
      { "@type": "Thing", name: "Ecommerce & Retail Tech" },
      { "@type": "Thing", name: "Luxury & Consumer" },
      { "@type": "Thing", name: "Jewellery Industry" },
    ],
    ...(digest.startISO && { datePublished: digest.startISO }),
    ...(digest.builtAtISO && { dateModified: digest.builtAtISO }),
  };

  // Build BreadcrumbList JSON-LD schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Archive",
        item: `${siteUrl}/archive`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `Week ${digest.weekLabel}`,
        item: `${siteUrl}/week/${digest.weekLabel}`,
      },
    ],
  };

  // Category UI meta data (same as home page)
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

  return (
    <>
      <JsonLd data={collectionPageSchema} />
      <JsonLd data={breadcrumbSchema} />
        <main className="w-full" style={{
          minHeight: '100vh',
          background: 'var(--color-bg)',
        }}>
        {/* STICKY FULL-SCREEN HERO */}
        <section className="relative h-[70vh] md:h-[100svh]" style={{ zIndex: 0 }}>
          {/* Sticky layer */}
          <div className="sticky top-0 h-[70vh] md:h-[100svh] overflow-hidden">
            {/* Cover image or gradient background */}
            {digest.coverImageUrl ? (
              <img
                src={digest.coverImageUrl}
                alt={digest.coverImageAlt || `Weekly digest cover for ${digest.weekLabel}`}
                className="absolute inset-0 w-full h-full object-cover md:object-contain"
              />
            ) : (
              <div 
                className="absolute inset-0 w-full h-full"
                style={{
                  background: 'linear-gradient(120deg, var(--color-deep) 50%, var(--color-accent) 100%)',
                }}
              />
            )}
            
            {/* Gradient overlay for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-black/0" />
            
            {/* "This week's cover" label - top left */}
            {digest.coverImageUrl && (
              <div className="absolute top-3 left-3 sm:top-6 sm:left-6 z-20">
                <p className="text-meta text-white font-medium" style={{
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                }}>
                  This week&apos;s cover
                </p>
              </div>
            )}
            
            {/* Hero content */}
            <div className="relative z-10 h-full flex items-start justify-center px-4 sm:px-6 md:px-8 pt-16 sm:pt-20 md:pt-24 lg:pt-28">
              <div className="w-full max-w-[1400px] lg:max-w-[1600px] 2xl:max-w-[1800px] mx-auto text-center">
                <div className="bg-black/20 backdrop-blur-sm rounded-xl md:rounded-2xl px-5 py-7 sm:px-6 sm:py-8 md:px-10 md:py-12 inline-block max-w-full mx-2 sm:mx-4 animate-fade-up">
                  <h1 className="font-bold mb-3 sm:mb-4 md:mb-5 text-hero text-white px-1" style={{
                    textShadow: '0 2px 8px rgba(0,0,0,0.5)'
                  }}>
                    Luxury Intelligence
                  </h1>
                  <div className="text-body text-gray-100 max-w-5xl mx-auto mb-2 sm:mb-2.5 md:mb-3 px-2" style={{
                    textShadow: '0 1px 4px rgba(0,0,0,0.3)'
                  }}>
                    Weekly intelligence across AI, ecommerce, luxury, and jewellery.
                  </div>
                  <p className="text-body text-gray-200 mb-4 sm:mb-5 md:mb-6 px-2 sm:px-3" style={{
                    textShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }}>
                    Curated articles, signals, and context — handpicked and summarised by AI agents each week.
                  </p>
                  {digest.weekLabel && (
                    <div className="mt-4 sm:mt-6 md:mt-8">
                      <h2 className="text-section font-bold text-white drop-shadow-lg px-2" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                        Week {digest.weekLabel}
                      </h2>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Scroll indicator - inside hero content area */}
              <div 
                className="absolute bottom-16 sm:bottom-32 left-1/2 pointer-events-none hidden sm:block"
                style={{
                  transform: 'translateX(-50%)',
                  zIndex: 50,
                  animation: 'scrollIndicator 2s ease-in-out infinite'
                }}
              >
                <div className="rounded-full px-4 py-3 sm:px-6 sm:py-5 bg-black/30 backdrop-blur-md shadow-lg border border-white/10">
                  <svg 
                    className="w-8 h-8 sm:w-10 sm:h-10 text-white opacity-80" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    {/* First chevron */}
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2.5} 
                      d="M19 9l-7 7-7-7" 
                    />
                    {/* Second chevron (shifted down) */}
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2.5} 
                      d="M19 15l-7 7-7-7" 
                    />
                  </svg>
                </div>
              </div>
            </div>
            
            {/* Date range and build info - bottom right */}
            {digest && (
              <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 sm:px-4 sm:py-2">
                  <div className="text-meta text-white leading-tight" style={{
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                  }}>
                    <span className="block sm:inline">
                      {dateRange}
                    </span>
                    {digest.builtAtISO && (
                      <span className="block sm:inline sm:ml-2">
                        <span className="hidden sm:inline">•</span> Built {formatDateTime(digest.builtAtISO)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Scroll progress bar */}
        <ScrollProgressBar />

        {/* PANELS SECTION - Overtaking Content */}
        <section className="relative z-20 -mt-[40vh] sm:-mt-[50vh] md:-mt-24 pt-2">
          {/* Panel Container */}
          <div className="w-full max-w-5xl mx-auto px-4 sm:px-5 md:px-6">
            {/* Breadcrumbs + first content: add mt-2 gap below week header */}
            <div className="mb-4 sm:mb-5 md:mb-6 mt-2">
              <Breadcrumbs
                  items={[
                    { label: 'Home', href: '/' },
                    { label: 'Archive', href: '/archive' },
                    { label: `Week ${digest.weekLabel}` },
                  ]}
                />
            </div>

            {/* Stats bar: article count between hero and category nav */}
            <StatsBar
              totalArticles={digest.totals.total}
              secondaryLine={formatStatsSecondaryLine(
                digest.totals.total,
                getSelectedArticleCount(digest),
                podcast?.duration != null ? podcast.duration / 60 : undefined
              )}
            />

            {/* Podcast + stats on cream */}
            <div className="bg-[var(--color-bg)] rounded-t-xl md:rounded-t-2xl border border-b-0 border-t border-t-[var(--color-accent)] border-black/5 p-6 sm:p-6 md:p-8 lg:p-10">
              {/* Podcast Player - At top of panel */}
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
                <CategoryCardGrid
                  cards={CATEGORY_CARDS.map((cat) => {
                    const byTopic = digest.totals?.byTopic as Record<string, number> | undefined;
                    return {
                      key: cat.key,
                      title: cat.title,
                      cardDesc: cat.cardDesc,
                      color: cat.color,
                      anchorId: cat.anchorId,
                      count: byTopic?.[cat.countBy] ?? 0,
                    };
                  })}
                />
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

              {/* CATEGORY SECTIONS UI - Client-side rendering with reactive TopN */}
              <Suspense fallback={
                <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {CATEGORY_CARDS.map(cat => (
                    <div key={cat.key} className="w-full">
                      <div className="bg-[var(--color-surface)] dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 md:p-7 h-64 animate-pulse" />
                    </div>
                  ))}
                </div>
              }>
                <AnalyticsDigestView weekLabel={weekLabel} />
                <DigestClientView digest={digest} categoryCards={CATEGORY_CARDS} variant="home" />
              </Suspense>

              {/* Key Themes Summary */}
              {(digest.keyThemes && digest.keyThemes.length > 0) || digest.oneSentenceSummary ? (
                <div className="mt-6 sm:mt-8 md:mt-10 pt-4 sm:pt-6 md:pt-8 border-t border-gray-200 dark:border-gray-700">
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

              {/* Week Navigation */}
              <nav className="mt-6 sm:mt-8 md:mt-10 pt-4 sm:pt-6 md:pt-8 border-t border-gray-200 dark:border-gray-700">
                <p className="text-meta text-gray-500 dark:text-gray-400 mb-4 text-center">Browse other weeks</p>
                <div className="flex items-center justify-between gap-4">
                  {previousWeek ? (
                    <Link
                      href={`/week/${previousWeek}`}
                      className="flex items-center gap-2 text-body text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded px-3 py-2"
                    >
                      <span className="text-gray-400 dark:text-gray-500">←</span>
                      <span>Previous week</span>
                      <span className="text-meta text-gray-500 dark:text-gray-400">({previousWeek})</span>
                    </Link>
                  ) : (
                    <div className="flex-1" />
                  )}
                  {nextWeek ? (
                    <Link
                      href={`/week/${nextWeek}`}
                      className="flex items-center gap-2 text-body text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded px-3 py-2 ml-auto"
                    >
                      <span className="text-meta text-gray-500 dark:text-gray-400">({nextWeek})</span>
                      <span>Next week</span>
                      <span className="text-gray-400 dark:text-gray-500">→</span>
                    </Link>
                  ) : (
                    <div className="flex-1" />
                  )}
                </div>
              </nav>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

