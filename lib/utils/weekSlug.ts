import { DateTime } from 'luxon';

/**
 * Convert an ISO week label to a human-readable URL slug.
 * '2026-W10' → 'march-2026-week-10'
 *
 * Uses Thursday of the ISO week to determine the month. ISO weeks are
 * defined by where their Thursday falls — Thursday is always in the same
 * calendar year as the ISO week year, and represents the majority month
 * when a week spans two months (Thu–Sun = 4 days vs Mon–Wed = 3 days).
 *
 * Example of why NOT Monday: ISO W01 2026 starts Mon Dec 29 2025, so
 * using Monday would produce "december-2026-week-1" (wrong).
 * Using Thursday (Jan 1 2026) correctly produces "january-2026-week-1".
 */
export function weekLabelToSlug(weekLabel: string): string {
  const match = weekLabel.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return weekLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const year    = parseInt(match[1]!, 10);
  const weekNum = parseInt(match[2]!, 10);

  const thursday = DateTime.fromObject(
    { weekYear: year, weekNumber: weekNum, weekday: 4 },
    { zone: 'Europe/Copenhagen' },
  );

  const month = thursday.toFormat('MMMM').toLowerCase(); // e.g. 'january'
  return `${month}-${year}-week-${weekNum}`;
}

/**
 * Convert a human-readable slug back to an ISO week label.
 * 'march-2026-week-10' → '2026-W10'
 *
 * Returns null if the slug doesn't match the expected pattern.
 */
export function slugToWeekLabel(slug: string): string | null {
  // Pattern: <month>-<year>-week-<n>
  const match = slug.match(/^[a-z]+-(\d{4})-week-(\d{1,2})$/);
  if (!match) return null;

  const year    = parseInt(match[1]!, 10);
  const weekNum = parseInt(match[2]!, 10);

  if (weekNum < 1 || weekNum > 53) return null;

  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}
