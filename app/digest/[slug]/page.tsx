import { Suspense } from 'react';
import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import DigestClientView from '../../components/DigestClientView';
import IssueRating from '../../components/IssueRating';
import CategoryCardGrid from '../../components/CategoryCardGrid';
import PodcastPlayer from '../../components/PodcastPlayer';
import StatsBar from '../../components/StatsBar';
import { WeeklyInsight } from '../../components/WeeklyInsight';
import { EditorSpotlight } from '../../components/EditorSpotlight';
import AnalyticsDigestView from '../../components/AnalyticsDigestView';
import TopNSelector from '../../components/TopNSelector';
import ScrollProgressBar from '../../components/ScrollProgressBar';
import JsonLd from '../../components/JsonLd';
import Breadcrumbs from '../../components/Breadcrumbs';
import { getTopicTotalsDisplayName, TopicKey } from '@/lib/utils/topicNames';
import { formatDateRange, formatDateTime } from '@/lib/utils/formatDate';
import { getSelectedArticleCount, formatStatsSecondaryLine } from '@/lib/utils/digestStats';
import { getSiteUrl } from '@/lib/utils/siteUrl';
import { weekLabelToSlug, slugToWeekLabel } from '@/lib/utils/weekSlug';
import { CATEGORY_COLORS } from '@/lib/constants/categoryColors';
import type { WeeklyDigest } from '@/lib/types';

// ── Meta description builder ──────────────────────────────────────────────────
function buildWeekMetaDescription(digest: WeeklyDigest, dateRange: string): string {
  const total    = digest.totals.total;
  const selected = getSelectedArticleCount(digest);
  const trunc    = (s: string, max: number) => s.length <= max ? s : s.slice(0, max - 1) + '…';

  if (digest.oneSentenceSummary) {
    const insight    = trunc(digest.oneSentenceSummary, 155);
    const withCount  = `${insight} (${total} articles · ${selected} curated)`;
    return withCount.length <= 155 ? withCount : insight;
  }

  const topTitle =
    digest.topics.AI_and_Strategy.top[0]?.title ??
    digest.topics.Ecommerce_Retail_Tech.top[0]?.title ??
    digest.topics.Luxury_and_Consumer.top[0]?.title ??
    null;

  const base = `${total} articles analysed across AI, ecommerce, luxury & jewellery · ${dateRange}.`;
  if (topTitle) return trunc(`${base} Top story: ${topTitle}`, 155);
  return base;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug }      = await params;
  const weekLabel     = slugToWeekLabel(slug);
  const siteUrl       = getSiteUrl();

  if (!weekLabel) {
    return { title: 'Digest Not Found' };
  }

  const digest  = await loadDigest(weekLabel);
  // Prefer the AI-generated cover; fall back to the branded dynamic OG card
  const ogImage = digest?.coverImageUrl
    ? `${siteUrl}${digest.coverImageUrl}`
    : `${siteUrl}/api/og?week=${encodeURIComponent(weekLabel)}`;

  const dateRange   = digest ? formatDateRange(digest.startISO, digest.endISO) : slug;
  const title       = `${dateRange} Intelligence Digest – AI, Ecommerce & Luxury`;
  const description = digest
    ? buildWeekMetaDescription(digest, dateRange)
    : `Curated intelligence for ${weekLabel} — AI, ecommerce, luxury and jewellery industry news with AI-assisted summaries.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/digest/${slug}`,
    },
    openGraph: {
      title: `${title} | Luxury Intelligence`,
      description,
      images: [ogImage],
    },
    twitter: {
      title: `${title} | Luxury Intelligence`,
      description,
      images: [ogImage],
    },
  };
}

async function loadDigest(weekLabel: string): Promise<WeeklyDigest | null> {
  // Defense-in-depth: ensure weekLabel is strictly YYYY-Www before building the path.
  // slugToWeekLabel already validates this, but we guard here too in case the
  // function is called from other callers in future.
  if (!/^\d{4}-W\d{1,2}$/.test(weekLabel)) return null;

  try {
    const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
    const raw = await fs.readFile(digestPath, 'utf-8');
    return JSON.parse(raw) as WeeklyDigest;
  } catch {
    return null;
  }
}

async function getAvailableWeeks(): Promise<string[]> {
  try {
    const digestsDir = path.join(process.cwd(), 'data', 'digests');
    const files      = await fs.readdir(digestsDir);
    return files
      .filter(file => /^(\d{4})-W(\d{1,2})\.json$/.test(file))
      .map(file => file.replace('.json', ''))
      .sort((a, b) => {
        const [yearA, weekA] = a.split('-W').map(Number);
        const [yearB, weekB] = b.split('-W').map(Number);
        if (yearA !== yearB) return yearA - yearB;
        return weekA - weekB;
      });
  } catch (err) {
    console.error('[Digest Navigation] Error getting available weeks:', err);
    return [];
  }
}

async function getWeekNavigation(weekLabel: string): Promise<{
  previousWeek: string | null;
  nextWeek: string | null;
}> {
  try {
    const availableWeeks = await getAvailableWeeks();
    const currentIndex   = availableWeeks.indexOf(weekLabel);
    if (currentIndex === -1) return { previousWeek: null, nextWeek: null };
    return {
      previousWeek: currentIndex > 0 ? availableWeeks[currentIndex - 1]! : null,
      nextWeek: currentIndex < availableWeeks.length - 1 ? availableWeeks[currentIndex + 1]! : null,
    };
  } catch (err) {
    console.error('[Digest Navigation] Error getting week navigation:', err);
    return { previousWeek: null, nextWeek: null };
  }
}

export default async function DigestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug }  = await params;
  const weekLabel = slugToWeekLabel(slug);

  if (!weekLabel) notFound();

  // Canonical redirect: if the slug doesn't match the current canonical form
  // (e.g. old "december-2026-week-1" → new "january-2026-week-1"), 308 to fix it.
  const canonicalSlug = weekLabelToSlug(weekLabel);
  if (slug !== canonicalSlug) {
    permanentRedirect(`/digest/${canonicalSlug}`);
  }

  const digest = await loadDigest(weekLabel);
  const { previousWeek, nextWeek } = await getWeekNavigation(weekLabel);

  // Load adjacent digests to get human-readable date ranges for nav labels
  const [prevDigest, nextDigest] = await Promise.all([
    previousWeek ? loadDigest(previousWeek) : Promise.resolve(null),
    nextWeek     ? loadDigest(nextWeek)     : Promise.resolve(null),
  ]);
  const prevLabel = prevDigest
    ? formatDateRange(prevDigest.startISO, prevDigest.endISO)
    : previousWeek ?? '';
  const nextLabel = nextDigest
    ? formatDateRange(nextDigest.startISO, nextDigest.endISO)
    : nextWeek ?? '';

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
    // Podcast doesn't exist for this week
  }

  if (!digest) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <h1 className="text-page-h1 font-bold mb-4 text-gray-900">Digest Not Found</h1>
        <p className="text-body text-gray-600 mb-4">
          The digest for {weekLabel} has not been built yet.
        </p>
        <p className="text-body text-gray-600 mb-8">
          Run: <code className="bg-gray-100 px-2 py-1 rounded text-meta font-mono">npx tsx scripts/buildWeeklyDigest.ts --week={weekLabel}</code>
        </p>
        <div className="flex gap-4">
          <Link href="/archive" className="text-blue-600 hover:text-blue-800 underline">← Archive</Link>
          <Link href="/" className="text-blue-600 hover:text-blue-800 underline">Home</Link>
        </div>
      </div>
    );
  }

  const dateRange = formatDateRange(digest.startISO, digest.endISO);
  const siteUrl   = getSiteUrl();

  const collectionPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${dateRange} – Weekly Intelligence Digest`,
    url: `${siteUrl}/digest/${slug}`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Luxury Intelligence',
      url: siteUrl,
    },
    about: [
      { '@type': 'Thing', name: 'AI & Strategy' },
      { '@type': 'Thing', name: 'Ecommerce & Retail Tech' },
      { '@type': 'Thing', name: 'Luxury & Consumer' },
      { '@type': 'Thing', name: 'Jewellery Industry' },
    ],
    ...(digest.startISO    && { datePublished: digest.startISO }),
    ...(digest.builtAtISO  && { dateModified:  digest.builtAtISO }),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',    item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Archive', item: `${siteUrl}/archive` },
      { '@type': 'ListItem', position: 3, name: dateRange, item: `${siteUrl}/digest/${slug}` },
    ],
  };

  const newsArticleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${dateRange} Intelligence Digest – AI, Ecommerce & Luxury`,
    description: digest.oneSentenceSummary
      ?? `Weekly curated digest: ${digest.totals.total} articles across AI, ecommerce, jewellery, and luxury.`,
    ...(digest.startISO   && { datePublished: digest.startISO }),
    ...(digest.builtAtISO && { dateModified:  digest.builtAtISO }),
    ...(digest.coverImageUrl && { image: `${siteUrl}${digest.coverImageUrl}` }),
    articleSection: 'AI & Strategy, Ecommerce & Retail Tech, Luxury & Consumer, Jewellery Industry',
    publisher: {
      '@type': 'Organization',
      name: 'Luxury Intelligence',
      url: siteUrl,
    },
    author: {
      '@type': 'Person',
      name: 'The Editor',
      url: `${siteUrl}/about`,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/digest/${slug}`,
    },
  };

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
      <JsonLd data={newsArticleSchema} />
      <JsonLd data={collectionPageSchema} />
      <JsonLd data={breadcrumbSchema} />
      <main className="w-full" style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>

        {/* STICKY FULL-SCREEN HERO */}
        <section className="relative h-[70vh] md:h-[100svh]" style={{ zIndex: 0 }}>
          <div className="sticky top-0 h-[70vh] md:h-[100svh] overflow-hidden">
            {digest.coverImageUrl ? (
              <img
                src={digest.coverImageUrl}
                alt={digest.coverImageAlt || `Weekly digest cover for ${digest.weekLabel}`}
                className="absolute inset-0 w-full h-full object-cover md:object-contain"
              />
            ) : (
              <div
                className="absolute inset-0 w-full h-full"
                style={{ background: 'linear-gradient(120deg, var(--color-deep) 50%, var(--color-accent) 100%)' }}
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-black/0" />

            {digest.coverImageUrl && (
              <div className="absolute top-3 left-3 sm:top-6 sm:left-6 z-20">
                <p className="text-meta text-white font-medium" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                  This week&apos;s cover
                </p>
              </div>
            )}

            <div className="relative z-10 h-full flex items-start justify-center px-4 sm:px-6 md:px-8 pt-16 sm:pt-20 md:pt-24 lg:pt-28">
              <div className="w-full max-w-[1400px] lg:max-w-[1600px] 2xl:max-w-[1800px] mx-auto text-center">
                <div className="bg-black/20 backdrop-blur-sm rounded-xl md:rounded-2xl px-5 py-7 sm:px-6 sm:py-8 md:px-10 md:py-12 inline-block max-w-full mx-2 sm:mx-4 animate-fade-up">
                  {/* Brand name — decorative, not the page h1 */}
                  <p className="font-bold mb-3 sm:mb-4 md:mb-5 text-hero-h1 text-white px-1" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                    Luxury Intelligence
                  </p>
                  <div className="text-body text-gray-100 max-w-5xl mx-auto mb-2 sm:mb-2.5 md:mb-3 px-2" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                    Weekly intelligence across AI, ecommerce, luxury, and jewellery.
                  </div>
                  <p className="text-body text-gray-200 mb-4 sm:mb-5 md:mb-6 px-2 sm:px-3" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                    Curated articles, signals, and context — handpicked and summarised by AI agents each week.
                  </p>
                  {/* Issue h1 — the unique, page-specific heading */}
                  {digest.weekLabel && (
                    <div className="mt-4 sm:mt-6 md:mt-8">
                      <h1 className="text-section font-bold text-white drop-shadow-lg px-2" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                        {dateRange} Intelligence Digest
                      </h1>
                    </div>
                  )}
                </div>
              </div>

              <div
                className="absolute bottom-16 sm:bottom-32 left-1/2 pointer-events-none hidden sm:block"
                style={{ transform: 'translateX(-50%)', zIndex: 50, animation: 'scrollIndicator 2s ease-in-out infinite' }}
              >
                <div className="rounded-full px-4 py-3 sm:px-6 sm:py-5 bg-black/30 backdrop-blur-md shadow-lg border border-white/10">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 15l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {digest && (
              <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 sm:px-4 sm:py-2">
                  <div className="text-meta text-white leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                    <span className="block sm:inline">{dateRange}</span>
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

        <ScrollProgressBar />

        {/* PANELS SECTION */}
        <section className="relative z-20 -mt-[40vh] sm:-mt-[50vh] md:-mt-24 pt-2">
          <div className="w-full max-w-5xl mx-auto px-4 sm:px-5 md:px-6">
            <div className="mb-4 sm:mb-5 md:mb-6 mt-2">
              <Breadcrumbs
                items={[
                  { label: 'Home',    href: '/' },
                  { label: 'Archive', href: '/archive' },
                  { label: dateRange },
                ]}
              />
            </div>

            <StatsBar
              totalArticles={digest.totals.total}
              secondaryLine={formatStatsSecondaryLine(
                digest.totals.total,
                getSelectedArticleCount(digest),
                podcast?.duration != null ? podcast.duration / 60 : undefined,
              )}
            />

            {(() => {
              const quote =
                digest.weeklyInsight ||
                digest.oneSentenceSummary ||
                digest.introParagraph ||
                digest.topics?.AI_and_Strategy?.top?.[0]?.aiSummary ||
                digest.topics?.Ecommerce_Retail_Tech?.top?.[0]?.aiSummary ||
                null;
              return quote ? <WeeklyInsight quote={quote} /> : null;
            })()}

            {/* EditorSpotlight hidden on archived pages for now */}

            <div className="bg-[var(--color-bg)] rounded-t-xl md:rounded-t-2xl border border-b-0 border-t border-t-[var(--color-accent)] border-black/5 p-4 sm:p-6 md:p-8 lg:p-10">
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
                    <span className="text-meta font-medium text-black/60">{digest.totals.total}</span>
                    <span className="text-meta text-black/40">articles analysed this week</span>
                  </div>
                </div>
              </div>

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

              {/* Issue Rating */}
              <div className="w-full max-w-5xl mx-auto px-4 py-10 md:py-16 text-center border-t border-[var(--color-border)]">
                <IssueRating slug={slug} />
              </div>

              {/* Issue Navigation */}
              <nav
                aria-label="Issue navigation"
                className="mt-6 sm:mt-8 md:mt-10 pt-4 sm:pt-6 md:pt-8 border-t border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Previous issue */}
                  {previousWeek ? (
                    <Link
                      href={`/digest/${weekLabelToSlug(previousWeek)}`}
                      className="group flex flex-col gap-0.5 max-w-[40%] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded px-1 py-1"
                    >
                      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors">
                        ← Previous Issue
                      </span>
                      <span className="font-serif text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors leading-snug">
                        {prevLabel}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex-1" />
                  )}

                  {/* Archive link — centred */}
                  <Link
                    href="/archive"
                    className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-accent)] hover:opacity-70 transition-opacity whitespace-nowrap self-center px-2"
                  >
                    View all issues
                  </Link>

                  {/* Next issue */}
                  {nextWeek ? (
                    <Link
                      href={`/digest/${weekLabelToSlug(nextWeek)}`}
                      className="group flex flex-col items-end gap-0.5 max-w-[40%] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded px-1 py-1"
                    >
                      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors">
                        Next Issue →
                      </span>
                      <span className="font-serif text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors leading-snug text-right">
                        {nextLabel}
                      </span>
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
