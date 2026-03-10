/**
 * Decorative diamond-ornament divider — replaces plain gold lines.
 * Purely decorative (aria-hidden).
 */
export default function Divider({
  className = '',
  variant = 'light',
}: {
  className?: string;
  variant?: 'light' | 'dark';
}) {
  const lineColor =
    variant === 'light' ? 'bg-[var(--color-accent)]/25' : 'bg-white/20';
  const diamondColor =
    variant === 'light'
      ? 'text-[var(--color-accent)]/40'
      : 'text-white/30';

  return (
    <div
      className={`flex items-center w-full max-w-xs mx-auto ${className}`}
      aria-hidden="true"
    >
      <span className={`flex-1 h-px ${lineColor}`} />
      <span className={`${diamondColor} text-xs mx-3 select-none`}>◇</span>
      <span className={`flex-1 h-px ${lineColor}`} />
    </div>
  );
}
