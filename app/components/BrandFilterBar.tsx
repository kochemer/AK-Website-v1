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

  const activeClass =
    'text-[var(--color-accent)] border-b-0';
  const inactiveClass =
    'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]';

  return (
    <div
      className="flex flex-wrap gap-x-5 gap-y-2 border-b border-[var(--color-border)]"
      role="group"
      aria-label="Filter by brand"
    >
      {/* All Brands pill */}
      <button
        type="button"
        onClick={() => handleSelect(null)}
        aria-pressed={!activeBrand}
        className={`brand-filter-btn relative pb-3 text-[12px] font-sans font-semibold tracking-[0.12em] uppercase transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
          !activeBrand ? activeClass : inactiveClass
        }`}
      >
        {allBrandsLabel}
      </button>

      {brands
        .filter((b) => b.count > 0)
        .map((brand) => {
          const isActive = activeBrand === brand.id;
          return (
            <button
              key={brand.id}
              type="button"
              onClick={() => handleSelect(brand.id)}
              aria-pressed={isActive}
              className={`brand-filter-btn relative pb-3 text-[12px] font-sans font-semibold tracking-[0.12em] uppercase transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                isActive ? activeClass : inactiveClass
              }`}
            >
              {brand.name}
              <span
                className={`ml-1.5 font-ibm-mono text-[10px] font-normal transition-opacity ${
                  isActive ? 'opacity-70' : 'opacity-40'
                }`}
              >
                {brand.count}
              </span>
            </button>
          );
        })}
    </div>
  );
}
