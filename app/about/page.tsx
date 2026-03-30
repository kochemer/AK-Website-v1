import Link from 'next/link';
import type { Metadata } from 'next';
import PipelineDiagram from '@/app/components/PipelineDiagram';
import { getSiteUrl } from '@/lib/utils/siteUrl';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: 'About – Luxury Intelligence',
  description: 'How Luxury Intelligence curates, scores, and summarises the week\'s most important news across AI, ecommerce, luxury, and jewellery.',
  alternates: {
    canonical: `${siteUrl}/about`,
  },
  openGraph: {
    title: 'About – Luxury Intelligence',
    description: 'How Luxury Intelligence curates, scores, and summarises the week\'s most important news across AI, ecommerce, luxury, and jewellery.',
    images: [`${siteUrl}/api/og`],
  },
  twitter: {
    title: 'About – Luxury Intelligence',
    description: 'How Luxury Intelligence curates, scores, and summarises the week\'s most important news across AI, ecommerce, luxury, and jewellery.',
    images: [`${siteUrl}/api/og`],
  },
};

export default function AboutPage() {
  return (
    <main style={{
      maxWidth: '100vw',
      minHeight: '100vh',
      background: 'var(--color-bg)',
      margin: 0,
      padding: 0,
    }}>
      {/* Hero Section */}
      <section style={{
        position: 'relative',
        width: '100%',
        minHeight: 280,
        background: 'linear-gradient(120deg,#2e3741 40%, #637b8b 100%)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        borderBottom: '8px solid #eaeaea'
      }}>
        <div className="w-full max-w-5xl mx-auto px-4 md:px-6" style={{
          position: 'relative',
          zIndex: 2,
          color: '#fff',
          padding: '3rem 1.5rem 2.5rem 1.5rem',
          textAlign: 'center',
        }}>
          <h1 className="text-page-h1 font-bold mb-4" style={{
            textShadow: '0 2px 8px rgba(18,30,49,0.20)'
          }}>
            About This Brief
          </h1>
          <div className="text-body text-gray-200 max-w-2xl mx-auto">
            ~53 curated sources, an AI ranking layer, and a two-stage editorial model — distilled into your weekly brief
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-20">
        <div className="max-w-prose">
        {/* Purpose Card */}
        <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 mb-12 md:mb-16">
          <h2 className="text-section font-semibold text-gray-900 mb-4">
            Purpose
          </h2>
          <p className="text-body text-gray-600 mb-4">
            Luxury Intelligence saves you hours of reading by curating the most relevant articles across four key sectors:
            <strong className="text-gray-900"> AI & Strategy</strong>,
            <strong className="text-gray-900"> Ecommerce & Retail Tech</strong>,
            <strong className="text-gray-900"> Luxury & Consumer</strong>, and
            <strong className="text-gray-900"> Jewellery Industry</strong>.
          </p>
          <p className="text-body text-gray-600">
            Every week, eight ranked articles are published to the web, delivered by email, and scripted into a
            podcast briefing — so you can read, skim, or listen depending on how your week is going.
          </p>
        </div>

        {/* How It Works Card */}
        <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border)] p-6 md:p-8 mb-12 md:mb-16">
          <h2 className="text-section font-semibold text-[var(--color-text-primary)] mb-2">
            How It Works
          </h2>
          <p className="text-body text-[var(--color-text-secondary)] mb-6">
            Five stages transform ~53 live sources into your weekly intelligence brief.
          </p>

          {/* Animated pipeline diagram */}
          <PipelineDiagram />

          {/* Detail rows */}
          <div className="mt-8 space-y-6 border-t border-[var(--color-border)] pt-8">
            <div className="flex gap-4">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-accent)] pt-1 w-28 shrink-0">
                Discovery
              </span>
              <p className="text-body text-[var(--color-text-secondary)]">
                We monitor ~53 RSS feeds from trusted industry publications across six source tiers — from global newswires
                to specialist jewellery trade press. A Tavily web-discovery layer runs in parallel to surface high-quality
                articles that fall outside the feed list.
              </p>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-accent)] pt-1 w-28 shrink-0">
                Curation
              </span>
              <p className="text-body text-[var(--color-text-secondary)]">
                Each article is deduped, classified into one of four categories using keyword and source heuristics,
                then pre-scored on{' '}
                <strong className="text-[var(--color-text-primary)]">recency</strong>,{' '}
                <strong className="text-[var(--color-text-primary)]">source weight</strong>, and{' '}
                <strong className="text-[var(--color-text-primary)]">keyword relevance</strong>.
                Source diversity guards prevent any single publication from dominating.
              </p>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-accent)] pt-1 w-28 shrink-0">
                Ranking
              </span>
              <p className="text-body text-[var(--color-text-secondary)]">
                The top 100 candidates per category are passed to a reasoning model (<code className="text-[11px] bg-[var(--color-surface-alt,#f5f0e8)] px-1 rounded">o4-mini</code>),
                which applies editorial judgement — originality, business materiality, timeliness — to select the final
                seven articles per category. A paywall filter ensures only articles with accessible full text are included
                in the email digest.
              </p>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-accent)] pt-1 w-28 shrink-0">
                Summaries
              </span>
              <p className="text-body text-[var(--color-text-secondary)]">
                Selected articles receive concise AI-generated summaries from title and snippet only — no full-article
                scraping, no paywalled content. A separate two-stage process generates the weekly one-sentence insight:
                one model proposes four analytically distinct candidates; a second model judges and selects the most
                original and thought-provoking one.
              </p>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-accent)] pt-1 w-28 shrink-0">
                Publishing
              </span>
              <p className="text-body text-[var(--color-text-secondary)]">
                The brief is published simultaneously to the web, delivered to subscribers by email, and scripted into
                a ~12–15 minute podcast briefing synthesised via ElevenLabs. A cover image is generated for each issue
                using a SceneDirector prompt pipeline designed to produce distinctive, non-generic editorial visuals.
              </p>
            </div>
          </div>

          {/* Methodology link */}
          <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
            <p className="text-body text-[var(--color-text-secondary)]">
              For the full technical breakdown of source tiers, scoring weights, and model selection, see the{' '}
              <Link href="/methodology" className="text-[var(--color-accent)] underline underline-offset-2 hover:opacity-80 transition-opacity font-medium">
                Methodology page →
              </Link>
            </p>
          </div>
        </div>

        {/* Transparency & Disclaimer Card */}
        <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 mb-12 md:mb-16">
          <h2 className="text-section font-semibold text-gray-900 mb-6">
            Transparency & Disclaimer
          </h2>
          <div className="bg-blue-50 border-l-4 border-blue-600 rounded p-4 mb-6">
            <p className="text-body text-gray-800 italic m-0">
              <strong>AI-Generated Content:</strong> Summaries are generated using AI and may contain inaccuracies or 
              miss important nuances. Always refer to the original article for complete information.
            </p>
          </div>
          <p className="text-body text-gray-600 mb-4">
            <strong className="text-gray-900">Not Investment or Business Advice:</strong> This digest is for 
            informational purposes only. Articles and summaries are not intended as investment, legal, or business advice.
          </p>
          <p className="text-body text-gray-600 mb-4">
            <strong className="text-gray-900">Source Selection:</strong> Sources are selected based on relevance, 
            quality, and regular publication schedules. We aim to include diverse perspectives but cannot guarantee 
            comprehensive coverage of all relevant publications.
          </p>
          <p className="text-body text-gray-600">
            <strong className="text-gray-900">Automated Process:</strong> This digest is generated automatically 
            through our ingestion, classification, and summarization pipeline. While we monitor for quality, the process 
            is largely automated and may occasionally include articles that don't perfectly match their assigned category.
          </p>
        </div>

        {/* Navigation */}
        <div style={{
          textAlign: 'center',
          marginTop: '2.5rem',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '1.5rem',
          }}>
            <Link href="/support" style={{
              fontWeight: 500,
              color: '#20678c',
              background: '#f4f7fa',
              borderRadius: 3,
              padding: '0.5rem 1.2rem',
              textDecoration: 'none',
              fontSize: '1rem',
              border: '1px solid #e7ecf0',
            }}>
              Support
            </Link>
          </div>
          <Link href="/" style={{
            fontWeight: 500,
            color: '#06244c',
            background: '#fed236',
            borderRadius: 3,
            padding: '0.65rem 1.6rem',
            textDecoration: 'none',
            display: 'inline-block',
            transition: 'background 0.19s, color 0.16s',
            fontSize: '1.12rem',
            boxShadow: '0 1px 2px rgba(0,0,0,0.07)'
          }}>
            Back to Home
          </Link>
        </div>
        </div>
      </section>
    </main>
  );
}

