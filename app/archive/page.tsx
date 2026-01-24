/**
 * This script renders an archive page for weekly digests in a Next.js application.
 * 
 * - It scans the folder `data/digests` on the server to find all available weekly digest files.
 * - Each digest file must be named in the format `YYYY-W##.json` (e.g., 2025-W52.json).
 * - The page lists all available digests in reverse chronological order,
 *   displaying a friendly week label and linking to the detail page for each digest.
 * - If no digests are available, it shows a message instructing the user to run `scripts/buildWeeklyDigest.ts`
 *   to create digest files.
 * 
 * The data is loaded and rendered server-side, so the archive reflects the current contents of the digests directory.
 */

import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import { DateTime } from 'luxon';
import type { Metadata } from 'next';
import JsonLd from '../components/JsonLd';
import Breadcrumbs from '../components/Breadcrumbs';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://luxury-intelligence.vercel.app";

export const metadata: Metadata = {
  title: 'Archive – Weekly AI & Luxury Industry Digests',
  description: 'Browse the complete archive of weekly AI, ecommerce, luxury and jewellery industry digests. Access all past curated intelligence briefs and weekly summaries.',
  alternates: {
    canonical: '/archive',
  },
  openGraph: {
    title: 'Archive – Weekly AI & Luxury Industry Digests',
    description: 'Browse the complete archive of weekly AI, ecommerce, luxury and jewellery industry digests. Access all past curated intelligence briefs and weekly summaries.',
    images: [`${siteUrl}/og-default.svg`],
  },
  twitter: {
    title: 'Archive – Weekly AI & Luxury Industry Digests',
    description: 'Browse the complete archive of weekly AI, ecommerce, luxury and jewellery industry digests. Access all past curated intelligence briefs and weekly summaries.',
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
        // Sort by year and week number
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

function formatWeekLabel(weekLabel: string): string {
  const [year, week] = weekLabel.split('-W').map(Number);
  return `Week ${week}, ${year}`;
}

export default async function ArchivePage() {
  const digests = await getAvailableDigests();

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
    ],
  };

  return (
    <>
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
            <img
              src="/weekly-images/archive-cover.png"
              alt="Archive cover"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectFit: 'cover' }}
            />
            {/* Fallback gradient (shown if image fails to load) */}
            <div 
              className="absolute inset-0 w-full h-full"
              style={{
                background: 'linear-gradient(120deg,#6b2d5c 50%, #8b4a7a 100%)',
                zIndex: -1,
              }}
            />
            
            {/* Gradient overlay for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-black/0" />
            
            {/* Hero content */}
            <div className="relative z-10 h-full flex items-center justify-center px-4 sm:px-6 md:px-8">
              <div className="w-full max-w-[1400px] lg:max-w-[1600px] 2xl:max-w-[1800px] mx-auto text-center">
                <div className="bg-black/20 backdrop-blur-sm rounded-xl md:rounded-2xl px-5 py-7 sm:px-6 sm:py-8 md:px-10 md:py-12 inline-block max-w-full mx-2 sm:mx-4">
                  <h1 className="font-bold mb-3 sm:mb-4 md:mb-5 text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl text-white leading-tight px-1" style={{
                    textShadow: '0 2px 8px rgba(0,0,0,0.5)'
                  }}>
                    Digest Archive
                  </h1>
                  <div className="text-gray-100 leading-relaxed max-w-5xl mx-auto mb-3 sm:mb-4 md:mb-5 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl px-2" style={{
                    textShadow: '0 1px 4px rgba(0,0,0,0.3)'
                  }}>
                    Browse all weekly intelligence digests
                  </div>
                  <p className="text-gray-200 mb-4 sm:mb-5 md:mb-6 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl italic px-2 sm:px-3" style={{
                    textShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }}>
                    Access past curated articles, signals, and context from previous weeks.
                  </p>
                  {digests.length > 0 && (
                    <div className="mt-4 sm:mt-6 md:mt-8">
                      <h2 className="text-lg sm:text-xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-white drop-shadow-lg px-2" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                        {digests.length} Week{digests.length !== 1 ? 's' : ''} Available
                      </h2>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Scroll indicator */}
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
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2.5} 
                      d="M19 9l-7 7-7-7" 
                    />
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
          </div>
        </section>

        {/* PANELS SECTION - Overtaking Content */}
        <section className="relative z-20 -mt-8 sm:-mt-12 md:-mt-24">
          {/* Panel Container */}
          <div className="w-full max-w-[1400px] lg:max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 sm:px-5 md:px-8">
            <div className="bg-white/95 dark:bg-zinc-950/90 backdrop-blur rounded-xl md:rounded-2xl shadow-lg border border-black/5 dark:border-white/10 p-4 sm:p-5 md:p-6 lg:p-10">
              {/* Breadcrumbs */}
              <div className="mb-6 sm:mb-8">
                <Breadcrumbs
                  items={[
                    { label: 'Home', href: '/' },
                    { label: 'Archive' },
                  ]}
                />
              </div>

              {digests.length > 0 ? (
                <div>
                  <p className="text-base sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-8 leading-relaxed">
                    Available weekly briefs:
                  </p>
                  <ul className="space-y-3 sm:space-y-4">
                    {digests.map((weekLabel) => {
                      const formatted = formatWeekLabel(weekLabel);
                      return (
                        <li key={weekLabel}>
                          <Link
                            href={`/week/${weekLabel}`}
                            className="block p-4 sm:p-5 md:p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg md:rounded-xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all duration-200"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <span className="font-semibold text-base sm:text-lg md:text-xl text-gray-900 dark:text-gray-100">
                                {formatted}
                              </span>
                              <span className="text-sm sm:text-base text-gray-500 dark:text-gray-400 font-mono">
                                {weekLabel}
                              </span>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
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
                  <h2 style={{margin: '0 0 1rem 0', fontSize: '1.6rem', fontWeight: 600}}>No digests available</h2>
                  <p style={{marginBottom:'1.1rem'}}>No weekly digests found in the archive.</p>
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
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
