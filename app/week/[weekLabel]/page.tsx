import { Suspense } from 'react';
import { promises as fs } from 'fs';
import path from 'path';
import { DateTime } from 'luxon';
import Link from 'next/link';
import type { Metadata } from 'next';
import DigestClientView from '../../components/DigestClientView';
import TopNSelector from '../../components/TopNSelector';
import JsonLd from '../../components/JsonLd';
import Breadcrumbs from '../../components/Breadcrumbs';
import { getTopicTotalsDisplayName, TopicKey } from '../../../utils/topicNames';
import { formatDate, formatDateRange, formatDateTime } from '../../../utils/formatDate';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://luxury-intelligence.vercel.app";

export async function generateMetadata({ params }: { params: Promise<{ weekLabel: string }> }): Promise<Metadata> {
  const { weekLabel } = await params;
  
  // Load digest to get cover image if available
  const digest = await loadDigest(weekLabel);
  const ogImage = digest?.coverImageUrl 
    ? `${siteUrl}${digest.coverImageUrl}`
    : `${siteUrl}/og-default.svg`;
  
  return {
    title: `Week ${weekLabel} – AI, Ecommerce & Luxury Industry Digest`,
    description: `Curated overview of the most relevant AI, ecommerce, luxury and jewellery industry news for week ${weekLabel}. Handpicked articles with AI summaries.`,
    alternates: {
      canonical: `/week/${weekLabel}`,
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

type Article = {
  id: string;
  title: string;
  url: string;
  source: string;
  published_at: string;
  ingested_at: string;
  aiSummary?: string | null;
};

type WeeklyDigest = {
  weekLabel: string;
  tz: string;
  startISO: string;
  endISO: string;
  builtAtISO?: string;
  builtAtLocal?: string;
  coverImageUrl?: string;
  coverImageAlt?: string;
  coverKeywords?: string[];
  keyThemes?: string[];
  oneSentenceSummary?: string;
  introParagraph?: string;
  totals: {
    total: number;
    byTopic: {
      AIStrategy: number;
      EcommerceRetail: number;
      LuxuryConsumer: number;
      Jewellery: number;
    };
  };
  topics: {
    AI_and_Strategy: { total: number; top: Article[] };
    Ecommerce_Retail_Tech: { total: number; top: Article[] };
    Luxury_and_Consumer: { total: number; top: Article[] };
    Jewellery_Industry: { total: number; top: Article[] };
  };
};


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
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">Invalid Week Format</h1>
        <p className="text-base md:text-lg text-gray-600 mb-8 leading-relaxed">
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
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">Digest Not Found</h1>
        <p className="text-base md:text-lg text-gray-600 mb-4 leading-relaxed">
          The digest for {weekLabel} has not been built yet.
        </p>
        <p className="text-sm md:text-base text-gray-600 mb-8 leading-relaxed">
          Run: <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">npx tsx scripts/buildWeeklyDigest.ts --week={weekLabel}</code>
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
    countBy: string;
    topInfo: string;
    anchorId: string;
  }> = [
    {
      key: 'Ecommerce_Retail_Tech',
      color: '#264653',
      title: 'Ecommerce & Retail Tech',
      desc: 'Breakthroughs and trends shaping online commerce, retail, and emerging tech.',
      countBy: 'EcommerceRetail',
      topInfo: 'Top 7 articles by recency',
      anchorId: 'ecommerce-retail-tech',
    },
    {
      key: 'Jewellery_Industry',
      color: '#be8b36',
      title: 'Jewellery Industry',
      desc: 'Key updates and articles across jewellery brands, trade, and supply chain.',
      countBy: 'Jewellery',
      topInfo: 'Top 7 articles by recency',
      anchorId: 'jewellery-industry',
    },
    {
      key: 'AI_and_Strategy',
      color: '#25505f',
      title: 'Artificial Intelligence News',
      desc: 'The latest advances and strategies in artificial intelligence and business transformation.',
      countBy: 'AIStrategy',
      topInfo: 'Top 7 articles by relevance',
      anchorId: 'ai-strategy',
    },
    {
      key: 'Luxury_and_Consumer',
      color: '#6b2d5c',
      title: 'Fashion & Luxury',
      desc: 'Innovations and changes in luxury and wider consumer products, experiences, and brands.',
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
        fontFamily: 'system-ui, Arial, sans-serif',
        background: '#f7f9fb',
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
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div 
                className="absolute inset-0 w-full h-full"
                style={{
                  background: 'linear-gradient(120deg,#6b2d5c 50%, #8b4a7a 100%)',
                }}
              />
            )}
            
            {/* Gradient overlay for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-black/0" />
            
            {/* "This week's cover" label - top left */}
            {digest.coverImageUrl && (
              <div className="absolute top-3 left-3 sm:top-6 sm:left-6 z-20">
                <p className="text-xs sm:text-sm md:text-base text-white font-medium" style={{
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                }}>
                  This week&apos;s cover
                </p>
              </div>
            )}
            
            {/* Hero content */}
            <div className="relative z-10 h-full flex items-start justify-center px-4 sm:px-6 md:px-8 pt-16 sm:pt-20 md:pt-24 lg:pt-28">
              <div className="w-full max-w-[1400px] lg:max-w-[1600px] 2xl:max-w-[1800px] mx-auto text-center">
                <div className="bg-black/20 backdrop-blur-sm rounded-xl md:rounded-2xl px-5 py-7 sm:px-6 sm:py-8 md:px-10 md:py-12 inline-block max-w-full mx-2 sm:mx-4">
                  <h1 className="font-bold mb-3 sm:mb-4 md:mb-5 text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl text-white leading-tight px-1" style={{
                    textShadow: '0 2px 8px rgba(0,0,0,0.5)'
                  }}>
                    Luxury Intelligence
                  </h1>
                  <div className="text-gray-100 leading-relaxed max-w-5xl mx-auto mb-2 sm:mb-2.5 md:mb-3 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl px-2" style={{
                    textShadow: '0 1px 4px rgba(0,0,0,0.3)'
                  }}>
                    Weekly intelligence across AI, ecommerce, luxury, and jewellery.
                  </div>
                  <p className="text-gray-200 mb-4 sm:mb-5 md:mb-6 text-[10px] sm:text-xs md:text-sm lg:text-base xl:text-lg px-2 sm:px-3" style={{
                    textShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }}>
                    Curated articles, signals, and context — handpicked and summarised by AI agents each week.
                  </p>
                  {digest.weekLabel && (
                    <div className="mt-4 sm:mt-6 md:mt-8">
                      <h2 className="text-base sm:text-lg md:text-3xl lg:text-4xl xl:text-5xl font-bold text-white drop-shadow-lg px-2" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
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
                  <div className="text-xs sm:text-xs md:text-sm text-white leading-tight" style={{
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

        {/* PANELS SECTION - Overtaking Content */}
        <section className="relative z-20 -mt-8 sm:-mt-12 md:-mt-24">
          {/* Panel Container */}
          <div className="w-full max-w-[1400px] lg:max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 sm:px-5 md:px-8">
            <div className="bg-white/95 dark:bg-zinc-950/90 backdrop-blur rounded-xl md:rounded-2xl shadow-lg border border-black/5 dark:border-white/10 p-4 sm:p-5 md:p-6 lg:p-10">
              {/* Breadcrumbs */}
              <div className="mb-4 sm:mb-5 md:mb-6">
                <Breadcrumbs
                  items={[
                    { label: 'Home', href: '/' },
                    { label: 'Archive', href: '/archive' },
                    { label: `Week ${digest.weekLabel}` },
                  ]}
                />
              </div>

              {/* Podcast Player - At top of panel */}
              {podcast && (
                <div className="mb-5 sm:mb-6 md:mb-8 pb-5 sm:pb-6 md:pb-8 border-b border-gray-200 dark:border-gray-700">
                  <div className="mb-3 sm:mb-3">
                    <h3 className="text-base sm:text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                      🎧 Weekly Luxury Intelligence Podcast · ~12 minutes
                    </h3>
                    <p className="text-sm sm:text-sm text-gray-600 dark:text-gray-400 italic mt-1.5 sm:mt-2">
                      Listen to this week&apos;s key ecommerce, jewellery & luxury stories
                    </p>
                  </div>
                  <audio
                    controls
                    preload="none"
                    className="w-full"
                    style={{
                      height: '48px',
                      minHeight: '48px',
                      borderRadius: '8px',
                    }}
                  >
                    <source src={podcast.audioPath} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {/* Category Control Bar - Editorial style */}
              <div className="mb-4 sm:mb-5 md:mb-6 pb-4 sm:pb-5 md:pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="rounded-xl md:rounded-2xl border border-black/5 bg-white/70 backdrop-blur-sm px-4 sm:px-4 md:px-5 py-3 sm:py-3 md:py-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 md:gap-3">
                    {/* Left: Category Label + Pills */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 md:gap-3 flex-wrap">
                      {/* Category Label */}
                      <span className="text-[11px] uppercase tracking-wider text-black/40 whitespace-nowrap">
                        Browse by category
                      </span>
                      
                      {/* Category Pills */}
                      <nav className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-2 items-center" aria-label="Category navigation">
                        {CATEGORY_CARDS.map(cat => (
                          <a
                            key={cat.anchorId}
                            href={`#${cat.anchorId}`}
                            className="rounded-full border border-black/10 bg-white px-3 py-1.5 sm:px-3.5 sm:py-2 md:px-3.5 md:py-1.5 text-xs sm:text-xs md:text-sm font-medium text-black/70 hover:bg-black/[0.02] hover:border-black/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-1 transition-colors min-h-[40px] sm:min-h-0 flex items-center justify-center"
                            style={{ minHeight: '40px' }}
                          >
                            {cat.title}
                          </a>
                        ))}
                      </nav>
                    </div>
                    
                    {/* Right: Top N + Article Count */}
                    <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 flex-shrink-0">
                      {/* Divider */}
                      <div className="w-px h-5 bg-black/10 hidden sm:block" />
                      
                      {/* Top N Selector */}
                      <div className="flex items-center">
                        <Suspense fallback={<div className="h-4 w-20" />}>
                          <TopNSelector />
                        </Suspense>
                      </div>
                      
                      {/* Divider */}
                      <div className="w-px h-5 bg-black/10 hidden sm:block" />
                      
                      {/* Article Count */}
                      <div className="flex flex-col items-end">
                        <span className="text-xs sm:text-xs md:text-sm font-medium text-black/60">
                          {digest.totals.total}
                        </span>
                        <span className="text-[10px] sm:text-[10px] md:text-[11px] text-black/40">
                          articles analysed this week
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

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

              {/* Key Themes Summary */}
              {(digest.keyThemes && digest.keyThemes.length > 0) || digest.oneSentenceSummary ? (
                <div className="mt-6 sm:mt-8 md:mt-10 pt-4 sm:pt-6 md:pt-8 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-center">
                    {digest.oneSentenceSummary && (
                      <p className="text-sm sm:text-base md:text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-3 sm:mb-4 px-2">
                        {digest.oneSentenceSummary}
                      </p>
                    )}
                    {digest.keyThemes && digest.keyThemes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
                        {digest.keyThemes.map((theme, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
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
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">Browse other weeks</p>
                <div className="flex items-center justify-between gap-4">
                  {previousWeek ? (
                    <Link
                      href={`/week/${previousWeek}`}
                      className="flex items-center gap-2 text-base text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded px-3 py-2"
                    >
                      <span className="text-gray-400 dark:text-gray-500">←</span>
                      <span>Previous week</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">({previousWeek})</span>
                    </Link>
                  ) : (
                    <div className="flex-1" />
                  )}
                  {nextWeek ? (
                    <Link
                      href={`/week/${nextWeek}`}
                      className="flex items-center gap-2 text-base text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded px-3 py-2 ml-auto"
                    >
                      <span className="text-sm text-gray-500 dark:text-gray-400">({nextWeek})</span>
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

