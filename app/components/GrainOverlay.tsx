'use client';

/**
 * Film-grain texture overlay using SVG feTurbulence.
 * Purely decorative — sits above backgrounds but below text.
 *
 * opacity: hero ~0.08, footer ~0.05
 * On mobile (<md) reduces to 0.03 via className override.
 */
export default function GrainOverlay({
  className = '',
  id = 'grain',
}: {
  className?: string;
  id?: string;
}) {
  return (
    <>
      {/* SVG filter definition — visually hidden */}
      <svg className="sr-only" aria-hidden="true">
        <filter id={id}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves={3}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>

      {/* Grain layer */}
      <div
        className={`absolute inset-0 pointer-events-none ${className}`}
        aria-hidden="true"
        style={{
          filter: `url(#${id})`,
          mixBlendMode: 'overlay',
        }}
      />
    </>
  );
}
