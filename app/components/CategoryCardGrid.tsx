'use client';

import CategoryCard from './CategoryCard';

type CardData = {
  key: string;
  title: string;
  cardDesc: string;
  color: string;
  anchorId: string;
  count: number;
};

/**
 * Responsive category cards:
 *   mobile  → horizontal scroll strip (shows current + peek of next)
 *   desktop → 2×2 grid
 */
export default function CategoryCardGrid({ cards }: { cards: CardData[] }) {
  return (
    <>
      {/* Mobile: horizontal carousel */}
      <div className="flex md:hidden overflow-x-auto snap-x snap-mandatory gap-3 px-4 pb-2 -mx-4 category-carousel">
        {cards.map((cat) => (
          <div key={cat.key} className="snap-start flex-shrink-0 w-[75vw] min-w-0">
            <CategoryCard
              title={cat.title}
              description={cat.cardDesc}
              articleCount={cat.count}
              color={cat.color}
              href={`#${cat.anchorId}`}
            />
          </div>
        ))}
      </div>

      {/* Desktop: 2×2 grid */}
      <div className="hidden md:grid grid-cols-2 gap-4">
        {cards.map((cat) => (
          <CategoryCard
            key={cat.key}
            title={cat.title}
            description={cat.cardDesc}
            articleCount={cat.count}
            color={cat.color}
            href={`#${cat.anchorId}`}
          />
        ))}
      </div>
    </>
  );
}
