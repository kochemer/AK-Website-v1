'use client';

import { useState, useEffect } from 'react';

interface IssueRatingProps {
  slug: string;
}

export default function IssueRating({ slug }: IssueRatingProps) {
  const storageKey = `rating-${slug}`;
  const [saved, setSaved] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) setSaved(Number(stored));
  }, [storageKey]);

  function handleSelect(star: number) {
    localStorage.setItem(storageKey, String(star));
    setSaved(star);
    fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, rating: star }),
    }).catch(() => {});
  }

  if (saved !== null) {
    return (
      <p className="font-serif italic text-[var(--color-accent)]">
        Thanks for the feedback ✦
      </p>
    );
  }

  return (
    <div>
      <p className="font-sans text-xs tracking-widest uppercase text-[var(--color-text-secondary)] mb-3"
         style={{ fontVariant: 'small-caps' }}>
        Rate this issue
      </p>
      <div
        className="flex justify-center gap-1"
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleSelect(star)}
            onMouseEnter={() => setHovered(star)}
            aria-label={`Rate ${star} out of 5`}
            className="flex items-center justify-center text-3xl leading-none transition-colors"
            style={{
              minWidth: 36,
              minHeight: 36,
              color: (hovered ?? 0) >= star
                ? 'var(--color-accent)'
                : 'rgb(214 211 209)', /* stone-300 */
            }}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
