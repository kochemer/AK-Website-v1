'use client';

/**
 * EditorSpotlight — weekly first-person editorial opinion by Alexey Kochemirovskiy.
 *
 * Styled as a newspaper column: left-rule accent, open prose, compact attribution.
 * Fades in on scroll intersection. Respects prefers-reduced-motion.
 *
 * Renders the `editorialTake` field from the digest JSON.
 * Content is AI-drafted; can be manually overridden (editorialTakeOverride flag).
 */

import { useRef, useState, useEffect } from 'react';

type EditorSpotlightProps = {
  text: string;
  weekLabel?: string;
  /** True when the curator has manually written or edited this take */
  isOverride?: boolean;
};

export function EditorSpotlight({ text, weekLabel, isOverride = false }: EditorSpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`my-8 md:my-10 transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div
        className="border-l-2 border-[var(--color-accent)] pl-5 sm:pl-6 md:pl-8 py-1"
        style={{ background: 'linear-gradient(to right, rgba(139, 105, 20, 0.05), transparent 55%)' }}
      >
        <div className="flex items-center gap-3 mb-4 md:mb-5">
          <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-[var(--color-accent)] whitespace-nowrap">
            Editor&apos;s Spotlight
          </span>
          <span
            className="flex-1 block h-px opacity-25"
            style={{ background: 'var(--color-accent)' }}
            aria-hidden="true"
          />
          {isOverride && (
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--color-text-secondary)] opacity-50">
              edited
            </span>
          )}
        </div>

        <div className="mb-5 md:mb-6 space-y-4">
          {text.split('\n\n').map((para, i) => (
            <p key={i} className="font-serif text-[1.0rem] sm:text-[1.0625rem] md:text-[1.125rem] leading-[1.78] text-[var(--color-text-primary)]">
              {para.trim()}
            </p>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <a
            href="https://www.linkedin.com/in/alexey-kochemirovskiy/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 group"
            aria-label="Editor Alexey Kochemirovskiy on LinkedIn"
          >
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 font-mono text-[9px] font-bold tracking-[0.04em] text-white"
              style={{ background: 'var(--color-accent)' }}
              aria-hidden="true"
            >
              AK
            </span>

            <span className="flex flex-col gap-0.5">
              <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors leading-none">
                Alexey Kochemirovskiy
              </span>
              <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--color-text-secondary)] opacity-60 leading-none">
                Ecommerce Strategy · Pandora
              </span>
            </span>

            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors opacity-60 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>

          {weekLabel && (
            <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-[var(--color-text-secondary)] opacity-35 select-none">
              {weekLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
