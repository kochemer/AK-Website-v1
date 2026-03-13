import { DateTime } from 'luxon';

/**
 * Convert an ISO week label to a human-readable URL slug.
 * '2026-W10' → 'march-2026-week-10'
 *
 * Uses Monday of the ISO week (Europe/Copenhagen) to determine the month.
 */
export function weekLabelToSlug(weekLabel: string): string {
  const match = weekLabel.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return weekLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const year    = parseInt(match[1]!, 10);
  const weekNum = parseInt(match[2]!, 10);

  const monday = DateTime.fromObject(
    { weekYear: year, weekNumber: weekNum, weekday: 1 },
    { zone: 'Europe/Copenhagen' },
  );

  const month = monday.toFormat('MMMM').toLowerCase(); // e.g. 'march'
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
