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
 * Get the current DIGEST week label — the current ISO week in CET.
 *
 * Semantics: the digest is built and published during the same week
 * (typically Saturday). The site displays this week's digest.
 */
export function getCurrentDigestWeek(): string {
  const now = DateTime.now().setZone(TZ);
  return formatWeekLabel(now);
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
