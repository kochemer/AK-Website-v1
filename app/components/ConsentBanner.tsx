'use client';

import { useEffect, useState } from 'react';
import { getAnalyticsConsent, setAnalyticsConsent } from '@/lib/analytics';

/**
 * Cookie/analytics consent banner.
 * Shows once to visitors who haven't made a choice.
 * Persists choice to localStorage via consent.ts.
 * Hidden in dev (consent is auto-granted there).
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Dev auto-grants consent — no banner needed
    if (process.env.NODE_ENV === 'development') return;

    const stored = localStorage.getItem('li_analytics_consent_v1');
    if (!stored) {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    setAnalyticsConsent('granted');
    setVisible(false);
  }

  function handleDecline() {
    setAnalyticsConsent('denied');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-accent)] bg-[var(--color-deep)] text-[#E5E2DB] px-6 py-5 md:py-4"
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
        <p className="font-sans text-[13px] text-[#999] leading-relaxed flex-1">
          We use analytics to understand how readers engage with the digest.
          No advertising. No third-party data sharing.{' '}
          <a
            href="/methodology"
            className="text-[var(--color-accent)] hover:underline"
          >
            Learn more
          </a>
          .
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDecline}
            className="font-mono text-[11px] tracking-[0.15em] uppercase text-[#666] hover:text-[#999] transition-colors px-4 py-2"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="font-mono text-[11px] tracking-[0.15em] uppercase bg-[var(--color-accent)] text-white px-5 py-2.5 rounded-[2px] hover:opacity-90 transition-opacity"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
