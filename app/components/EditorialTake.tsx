/**
 * EditorialTake — weekly first-person editor commentary.
 *
 * Renders the `editorialTake` field from the digest JSON.
 * Content is AI-generated but can be manually overridden (editorialTakeOverride flag).
 * Visually styled as a newspaper editorial block.
 */

type EditorialTakeProps = {
  text: string;
  /** Whether this take was manually written/edited by the curator */
  isOverride?: boolean;
};

export function EditorialTake({ text, isOverride = false }: EditorialTakeProps) {
  return (
    <div className="my-6 sm:my-8 md:my-10">
      <div
        className="border-t-2 border-[var(--color-accent)] pt-6 md:pt-8"
        style={{ borderTopWidth: '2px' }}
      >
        {/* Label row */}
        <div className="flex items-center justify-between mb-4 md:mb-5">
          <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-[var(--color-accent)]">
            Editor&apos;s Take
          </p>
          {isOverride && (
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--color-text-secondary)] opacity-60">
              edited
            </span>
          )}
        </div>

        {/* Editorial prose */}
        <blockquote className="font-serif text-[1.05rem] md:text-[1.15rem] leading-relaxed text-[var(--color-text-primary)] mb-4 md:mb-5 not-italic">
          {text}
        </blockquote>

        {/* Attribution */}
        <a
          href="https://www.linkedin.com/in/alexey-kochemirovskiy/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 group"
          aria-label="Alexey Kochemirovskiy on LinkedIn"
        >
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors">
            — Alexey Kochemirovskiy
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors opacity-70"
            aria-hidden="true"
          >
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
