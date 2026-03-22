type Props = {
  bullets: string[];
  generatedAt: string | null;
};

export default function CompetitorBriefing({ bullets, generatedAt }: Props) {
  if (bullets.length === 0) return null;

  return (
    <section className="bg-[var(--color-accent-light)] border-l-4 border-[var(--color-accent)] rounded-sm p-5 md:p-7 mb-10">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-accent)] font-sans font-semibold">
          Weekly Briefing
        </p>
        {generatedAt && (
          <span className="text-[11px] text-[var(--color-text-secondary)] font-sans">
            {new Date(generatedAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex gap-3 text-body text-[var(--color-text-primary)]">
            <span className="text-[var(--color-accent)] font-bold shrink-0 mt-0.5">·</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
