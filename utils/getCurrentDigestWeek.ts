/**
 * Shared utility to get the current digest week label.
 * This ensures the home page and email digest page stay synchronized.
 * 
 * For now, returns a hardcoded week (2026-W04).
 * In production, this could be updated to:
 * - Return the latest available digest week
 * - Return getPreviousWeek() for consistency
 * - Use an environment variable
 */

import { DateTime } from 'luxon';

/**
 * Get the current digest week label.
 * Currently hardcoded to 2026-W04 for consistency.
 */
export function getCurrentDigestWeek(): string {
  // Hardcoded for now - update this when moving to a new week
  return '2026-W04';
  
  // Future options:
  // Option 1: Always show previous week
  // const now = DateTime.now().setZone('Europe/Copenhagen');
  // const previousWeek = now.minus({ weeks: 1 });
  // return `${previousWeek.year}-W${previousWeek.weekNumber.toString().padStart(2, '0')}`;
  
  // Option 2: Get latest available digest week
  // (would need to scan data/digests directory)
}

/**
 * Get the previous week label (helper function).
 */
export function getPreviousWeek(): string {
  const now = DateTime.now().setZone('Europe/Copenhagen');
  const previousWeek = now.minus({ weeks: 1 });
  return `${previousWeek.year}-W${previousWeek.weekNumber.toString().padStart(2, '0')}`;
}
