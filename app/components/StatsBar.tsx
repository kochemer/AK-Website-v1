'use client';

import { useRef, useState, useEffect } from 'react';

const DURATION_MS = 1600;
const FPS = 60;

type StatsBarProps = {
  /** Total articles analysed (counts up from 0) */
  totalArticles: number;
  /** Label below the number, e.g. "articles analysed this week" */
  primaryLabel?: string;
  /** Optional secondary line, e.g. "47 selected · 4 categories" */
  secondaryLine?: string;
};

export default function StatsBar({ totalArticles, primaryLabel = 'articles analysed this week', secondaryLine }: StatsBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || hasAnimated || totalArticles <= 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        setHasAnimated(true);

        const startTime = performance.now();
        const startValue = 0;
        const endValue = totalArticles;

        const tick = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / DURATION_MS, 1);
          // Ease-out cubic for a smooth slowdown at the end
          const eased = 1 - (1 - progress) ** 3;
          const current = Math.round(startValue + (endValue - startValue) * eased);
          setDisplayValue(current);
          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            setDisplayValue(endValue);
          }
        };

        requestAnimationFrame(tick);
      },
      { threshold: 0.2, rootMargin: '0px 0px -50px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [totalArticles, hasAnimated]);

  return (
    <div
      ref={containerRef}
      className="w-full py-10 sm:py-12 bg-[var(--color-accent-light)] text-center"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Primary stat: count in gold */}
        <div className="font-serif text-stat-number font-bold text-[var(--color-accent)] tabular-nums">
          {displayValue.toLocaleString()}
        </div>
        <p className="text-stat-label uppercase tracking-widest text-[var(--color-text-secondary)] mt-2">
          {primaryLabel}
        </p>

        {/* Optional secondary stats */}
        {secondaryLine && (
          <p className="mt-4 text-meta text-[var(--color-text-secondary)] opacity-80">
            {secondaryLine}
          </p>
        )}
      </div>
    </div>
  );
}
