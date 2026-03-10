/**
 * Seamless tiling diamond/rhombus SVG pattern used as a subtle brand motif.
 * Renders at very low opacity so it registers subconsciously, not consciously.
 *
 * variant="light" → gold (#8B6914) strokes on light backgrounds
 * variant="dark"  → cream (#FAF9F6) strokes on dark backgrounds
 */
export default function BrandPattern({
  variant = 'light',
  className = '',
}: {
  variant?: 'light' | 'dark';
  className?: string;
}) {
  const stroke = variant === 'light' ? '#8B6914' : '#FAF9F6';
  const opacity = variant === 'light' ? 0.04 : 0.045;

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden="true"
      style={{ opacity }}
    >
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id={`diamond-${variant}`}
            x="0"
            y="0"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            {/* Primary diamond */}
            <path
              d="M24 4 L44 24 L24 44 L4 24 Z"
              fill="none"
              stroke={stroke}
              strokeWidth="0.75"
            />
            {/* Inner facet lines — art-deco lattice feel */}
            <path
              d="M24 12 L36 24 L24 36 L12 24 Z"
              fill="none"
              stroke={stroke}
              strokeWidth="0.5"
            />
            {/* Corner connecting diamonds (tile edges) */}
            <path
              d="M0 0 L4 4 M48 0 L44 4 M0 48 L4 44 M48 48 L44 44"
              fill="none"
              stroke={stroke}
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#diamond-${variant})`} />
      </svg>
    </div>
  );
}
