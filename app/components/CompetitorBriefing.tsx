type Props = {
  bullets: string[];
  generatedAt: string | null;
};

export default function CompetitorBriefing({ bullets, generatedAt }: Props) {
  if (bullets.length === 0) return null;

  const dateLabel = generatedAt
    ? new Date(generatedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Watermark: month + year printed large in the background
  const dayNumber = generatedAt
    ? new Date(generatedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : null;

  return (
    <section className="intel-briefing-bg relative mb-12 overflow-hidden">
      {/* Gold hairline top border */}
      <div className="intel-rule intel-rule-animated mb-0" />

      {/* Watermark — month/year printed large, background depth */}
      {dayNumber && (
        <div
          aria-hidden
          className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none select-none leading-none font-display font-semibold"
          style={{
            fontSize: 'clamp(4rem, 12vw, 9rem)',
            opacity: 0.035,
            color: 'var(--color-accent)',
            whiteSpace: 'nowrap',
          }}
        >
          {dayNumber}
        </div>
      )}

      <div className="py-8 pr-4">
        {/* Header row */}
        <div className="flex items-baseline gap-4 mb-6 flex-wrap">
          <p className="intel-section-label text-[var(--color-accent)]">
            Weekly Briefing
          </p>
          {dateLabel && (
            <span className="text-[12px] font-sans text-[var(--color-text-secondary)] tracking-wide">
              {dateLabel}
            </span>
          )}
        </div>

        {/* Bullets — editorial dense list */}
        <ul className="space-y-4 relative">
          {bullets.map((bullet, i) => (
            <li key={i} className="flex gap-4 leading-relaxed">
              <span
                className="shrink-0 mt-[0.3em] font-display font-semibold select-none"
                style={{ color: 'var(--color-accent)', fontSize: '1.1em' }}
                aria-hidden
              >
                —
              </span>
              <span className="text-body text-[var(--color-text-primary)]">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Gold hairline bottom border */}
      <div className="intel-rule mb-0 opacity-15" />
    </section>
  );
}
