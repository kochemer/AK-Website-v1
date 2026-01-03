import { promises as fs } from 'fs';
import path from 'path';
import { DateTime } from 'luxon';
import Link from 'next/link';
import Image from 'next/image';
import BuildDigestButton from './components/BuildDigestButton';
import CategorySection from './components/CategorySection';
import ArticleCard from './components/ArticleCard';
import { getTopicDisplayName, TopicKey } from '../utils/topicNames';
import { formatDate } from '../utils/formatDate';

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

function getCurrentWeek(): string {
  const now = DateTime.now().setZone('Europe/Copenhagen');
  const year = now.year;
  const weekNumber = now.weekNumber;
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}


async function loadDigest(weekLabel: string): Promise<WeeklyDigest | null> {
  try {
    const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
    const raw = await fs.readFile(digestPath, 'utf-8');
    return JSON.parse(raw) as WeeklyDigest;
  } catch (err) {
    console.error(`Failed to load digest for ${weekLabel}:`, err);
    return null;
  }
}

// Category UI meta data (title, short desc, topicKey, N)
// Ordered for display: Ecommerce, AI, Jewellery, Luxury
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
    key: 'AI_and_Strategy',
    color: '#25505f',
    title: 'AI & Strategy',
    desc: 'The latest advances and strategies in artificial intelligence and business transformation.',
    countBy: 'AIStrategy',
    topInfo: 'Top 7 articles by relevance',
    anchorId: 'ai-strategy',
  },
  {
    key: 'Jewellery_Industry',
    color: '#be8b36',
    title: 'Jewellery Industry',
    desc: 'Key updates and stories across jewellery brands, trade, and supply chain.',
    countBy: 'Jewellery',
    topInfo: 'Top 7 articles by recency',
    anchorId: 'jewellery-industry',
  },
  {
    key: 'Luxury_and_Consumer',
    color: '#6b2d5c',
    title: 'Luxury & Consumer',
    desc: 'Innovations and changes in luxury and wider consumer products, experiences, and brands.',
    countBy: 'LuxuryConsumer',
    topInfo: 'Top 7 articles by recency',
    anchorId: 'luxury-consumer',
  },
];


export default async function Home() {
  const weekLabel = getCurrentWeek();
  const digest = await loadDigest(weekLabel);

  // HERO section (always present)
  return (
    <main className="w-full" style={{
      minHeight: '100vh',
      fontFamily: 'system-ui, Arial, sans-serif',
      background: '#f7f9fb',
    }}>
      {/* HERO */}
      <section style={{
        position: 'relative',
        width: '100%',
        minHeight: 360,
        background: 'linear-gradient(120deg,#2e3741 40%, #637b8b 100%)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        borderBottom: '8px solid #eaeaea'
      }}>
        <div style={{
          position: 'absolute',
          zIndex: 0,
          top: 0, left: 0, width: '100%', height: '100%',
        }}>
            <Image
              src="/hero-digest.jpg"
              alt="Weekly Digest Hero"
              priority
              fill
              style={{ objectFit: 'cover', objectPosition: 'center center', filter: 'brightness(0.62) blur(0.2px)' }}
            />
        </div>
        <div className="w-full max-w-[1200px] lg:max-w-[1400px] 2xl:max-w-[1560px] mx-auto px-4 md:px-8" style={{
          position: 'relative',
          zIndex: 2,
          color: '#fff',
          padding: '3rem 1.5rem 2.5rem 1.5rem',
          textAlign: 'center',
        }}>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{
            textShadow: '0 2px 8px rgba(18,30,49,0.20)'
          }}>
            Luxury Intelligence
          </h1>
          <div className="text-lg md:text-xl text-gray-200 leading-relaxed max-w-2xl mx-auto">
            <span style={{ fontWeight: 600, color: '#fff' }}>Luxury Ecommerce, Retail Technology & AI</span><br/>
            Essential intelligence handpicked across strategy, ecommerce, luxury, and jewellery.<br/>
            Save hours weekly – get expert-curated coverage, <span style={{ color: '#fed236' }}>AI summaries</span>, and direct source links.
          </div>
          <div style={{marginTop: '1.7rem', display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap'}}>
            <Link href="/archive" style={{
              fontWeight: 500,
              color: '#06244c',
              background: '#fed236',
              borderRadius: 3,
              padding: '0.65rem 1.6rem',
              textDecoration: 'none',
              transition: 'background 0.19s, color 0.16s',
              fontSize: '1.12rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.07)'
            }}>Browse Archive</Link>
            <Link href="/about" style={{
              fontWeight: 500,
              color: '#fff',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 3,
              padding: '0.65rem 1.6rem',
              textDecoration: 'none',
              transition: 'background 0.19s, color 0.16s',
              fontSize: '1.12rem',
              border: '1px solid rgba(255,255,255,0.3)'
            }}>About</Link>
            <Link href="/support" style={{
              fontWeight: 500,
              color: '#fff',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 3,
              padding: '0.65rem 1.6rem',
              textDecoration: 'none',
              transition: 'background 0.19s, color 0.16s',
              fontSize: '1.12rem',
              border: '1px solid rgba(255,255,255,0.3)'
            }}>Support</Link>
            <BuildDigestButton />
          </div>
        </div>
      </section>

      {/* If digest missing, show clear notice */}
      {!digest ? (
        <section style={{
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
          <BuildDigestButton />
        </section>
      ) : (
      <>
        {/* Weekly Digest Summary / Meta */}
        <section className="w-full max-w-[1200px] lg:max-w-[1400px] 2xl:max-w-[1560px] mx-auto px-4 md:px-8 mb-12 md:mb-16" style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 2px 24px 0 rgba(28,68,90,.06)',
          margin: '-64px auto 0 auto',
          padding: '2.5rem 2rem',
          position: 'relative'
        }}>
          <div className="flex items-end justify-between mb-4 flex-wrap gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-2">
                Week {digest.weekLabel}
              </h2>
              <p className="text-base md:text-lg text-gray-600 mb-1">
                {formatDate(digest.startISO)} to {formatDate(digest.endISO)} ({digest.tz})
              </p>
              {digest.builtAtLocal && (
                <p className="text-sm text-gray-500">
                  Built: {digest.builtAtLocal}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm md:text-base text-gray-600 mb-1">
                Digest total
              </p>
              <p className="text-3xl md:text-4xl font-bold text-blue-700">
                {digest.totals.total}
              </p>
            </div>
          </div>
        </section>

        {/* Category Jump Navigation */}
        <section className="w-full max-w-[1200px] lg:max-w-[1400px] 2xl:max-w-[1560px] mx-auto px-4 md:px-8 mb-12 md:mb-16">
          <nav className="flex flex-wrap gap-2 justify-center" aria-label="Category navigation">
            {CATEGORY_CARDS.map(cat => (
              <a
                key={cat.anchorId}
                href={`#${cat.anchorId}`}
                className="px-4 py-2 text-sm font-medium border border-gray-200 bg-gray-50 text-gray-700 rounded-full hover:bg-gray-100 hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
              >
                {cat.title}
              </a>
            ))}
          </nav>
        </section>

        {/* CATEGORY SECTIONS UI - 12 Column Grid */}
        <section className="w-full max-w-[1200px] lg:max-w-[1400px] 2xl:max-w-[1560px] mx-auto px-4 md:px-8 mb-16 md:mb-20">
          <div className="w-full grid grid-cols-12 gap-8 lg:gap-10">
            {CATEGORY_CARDS.map(cat => {
              // @ts-ignore
              const topic = digest.topics[cat.key];
              // @ts-ignore
              const totalCat = digest.totals.byTopic[cat.countBy] ?? 0;
              
              // Format articles with dates at page level
              const formattedArticles = (topic?.top || []).slice(0, 7).map(article => ({
                ...article,
                date: formatDate(article.published_at),
              }));
              
              return (
                <div key={cat.key} className="col-span-12 lg:col-span-6 w-full">
                  <CategorySection
                    id={cat.anchorId}
                    variant="grid"
                    title={getTopicDisplayName(cat.key)}
                    description={cat.desc}
                    count={totalCat}
                    articles={formattedArticles}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </>
      )}
    </main>
  );
}
