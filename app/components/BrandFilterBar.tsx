'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { CompetitorId } from '@/lib/constants/competitorBrands';

export type BrandSummary = {
  id: CompetitorId;
  name: string;
  count: number;
};

type BrandFilterBarProps = {
  brands: BrandSummary[];
  activeBrand?: string;
  /** Base path for navigation, e.g. '/competitor-watch' or '/es/competitor-watch' */
  basePath: string;
  allBrandsLabel?: string;
};

export default function BrandFilterBar({
  brands,
  activeBrand,
  basePath,
  allBrandsLabel = 'All Brands',
}: BrandFilterBarProps) {
  const router = useRouter();

  const handleSelect = useCallback(
    (id: CompetitorId | null) => {
      if (id === null) {
        router.push(basePath);
      } else {
        router.push(`${basePath}?brand=${id}`);
      }
    },
    [router, basePath]
  );

  const activePill =
    'bg-[var(--color-accent)] text-white border-[var(--color-accent)]';
  const inactivePill =
    'bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]';

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Filter by brand"
    >
      <button
        type="button"
        onClick={() => handleSelect(null)}
        className={`px-3 py-1.5 rounded-[3px] text-sm font-medium font-sans transition-colors border ${
          !activeBrand ? activePill : inactivePill
        }`}
        aria-pressed={!activeBrand}
      >
        {allBrandsLabel}
      </button>

      {brands
        .filter((b) => b.count > 0)
        .map((brand) => (
          <button
            key={brand.id}
            type="button"
            onClick={() => handleSelect(brand.id)}
            className={`px-3 py-1.5 rounded-[3px] text-sm font-medium font-sans transition-colors border ${
              activeBrand === brand.id ? activePill : inactivePill
            }`}
            aria-pressed={activeBrand === brand.id}
          >
            {brand.name}
            <span className="ml-1.5 text-xs opacity-60">{brand.count}</span>
          </button>
        ))}
    </div>
  );
}
