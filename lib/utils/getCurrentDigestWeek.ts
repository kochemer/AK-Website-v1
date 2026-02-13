/**
 * Shared utility to get the current week labels for digests & ingestion.
 *
 * Week computation rule (CET / Europe/Copenhagen):
 *   - getCurrentDigestWeek()  → the current ISO week in CET.
 *     This is the week whose digest is displayed on the site.
 *     The digest is built and published during the same week
 *     (typically on Saturday), so it returns the current week.
 *   - getCurrentIngestionWeek() → same as getCurrentDigestWeek().
 *     Ingestion/discovery also targets the current week.
 *
 * Both return format "YYYY-Www" (zero-padded week number).
 *
 * All scripts that accept --week CLI overrides still win when provided.
 */

import { DateTime } from 'luxon';

const TZ = 'Europe/Copenhagen';
const WEEK_LABEL_RE = /^\d{4}-W\d{2}$/;

/**
 * Validate that a weekLabel matches the expected format YYYY-Www.
 * Throws if invalid (fail-fast).
 */
export function validateWeekLabel(weekLabel: string): void {
  if (!WEEK_LABEL_RE.test(weekLabel)) {
    throw new Error(
      `Invalid weekLabel format: "${weekLabel}". Expected YYYY-Www (e.g. 2026-W06).`
    );
  }
}

/**
 * Build a "YYYY-Www" label from a Luxon DateTime.
 * Uses ISO weekYear + weekNumber so Jan-1 edge cases are correct.
 */
function formatWeekLabel(dt: DateTime): string {
  const label = `${dt.weekYear}-W${dt.weekNumber.toString().padStart(2, '0')}`;
  validateWeekLabel(label);
  return label;
}

/**
 * Get the current DIGEST week label — shows previous week by default, switches to new week only on Sunday.
 *
 * Semantics: 
 *   - Shows the previous week by default (e.g., Week 6)
 *   - Only switches to the new week (e.g., Week 7) on Sunday of that week
 *   - Before Sunday of the new week, the previous week's digest is displayed
 * 
 * Example:
 *   - Monday-Saturday of Week 7 → returns Week 6
 *   - Sunday of Week 7 → returns Week 7
 *   - Monday-Saturday of Week 8 → returns Week 7
 *   - Sunday of Week 8 → returns Week 8
 */
export function getCurrentDigestWeek(): string {
  const now = DateTime.now().setZone(TZ);
  const currentWeek = formatWeekLabel(now);
  
  // If today is Sunday (day 7), show the current week
  // Otherwise (Monday-Saturday), show the previous week
  if (now.weekday === 7) {
    // Sunday: show current week (e.g., Week 7 on Sunday of Week 7)
    return currentWeek;
  } else {
    // Monday-Saturday: show previous week
    // Go back 7 days to get the previous week
    const previousWeekDate = now.minus({ days: 7 });
    return formatWeekLabel(previousWeekDate);
  }
}

/**
 * Get the current INGESTION week label — the ISO week that contains "now" in CET.
 *
 * Semantics: ingestion/discovery collects articles for the week in progress.
 */
export function getCurrentIngestionWeek(): string {
  const now = DateTime.now().setZone(TZ);
  return formatWeekLabel(now);
}

/**
 * Alias kept for backward compatibility.
 * Identical to getCurrentDigestWeek().
 */
export function getPreviousWeek(): string {
  return getCurrentDigestWeek();
}
