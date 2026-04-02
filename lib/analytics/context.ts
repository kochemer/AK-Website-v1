/**
 * Global event properties attached to every analytics event.
 * See measurement-plan.md §4.
 */

import { getLastClickAttribution, getFirstTouchAttribution } from './attribution';

function resolveAppEnv(): string {
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (vercelEnv === 'production') return 'prod';
  if (vercelEnv === 'preview') return 'preview';
  return 'dev';
}

function inferPageType(path: string): string {
  if (path === '/') return 'home';
  if (path.startsWith('/digest/')) return 'digest';
  if (path.startsWith('/week/')) return 'digest'; // legacy redirect path
  if (path.startsWith('/email-digest')) return 'email_digest';
  if (path.startsWith('/subscribe')) return 'subscribe';
  if (path.startsWith('/archive')) return 'archive';
  if (path.startsWith('/methodology')) return 'methodology';
  if (path.startsWith('/about')) return 'about';
  return 'other';
}

function extractWeekFromPath(path: string): string | null {
  // New canonical format: /digest/march-2026-week-10 → 2026-W10
  const digestMatch = path.match(/\/digest\/[a-z]+-(\d{4})-week-(\d{1,2})/);
  if (digestMatch) {
    const year    = digestMatch[1]!;
    const weekNum = String(digestMatch[2]!).padStart(2, '0');
    return `${year}-W${weekNum}`;
  }
  // Legacy format (caught during redirect): /week/2026-W10
  const legacyMatch = path.match(/\/week\/(\d{4}-W\d{2})/);
  return legacyMatch ? legacyMatch[1]! : null;
}

export function getGlobalEventProps(): Record<string, unknown> {
  const base: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    schema_version: 1,
    app_env: resolveAppEnv(),
  };

  if (typeof window === 'undefined') return base;

  const routePath = window.location.pathname;

  const attrib = getLastClickAttribution();
  const firstTouch = getFirstTouchAttribution(attrib);

  return {
    ...base,
    route_path: routePath,
    page_type: inferPageType(routePath),
    week: extractWeekFromPath(routePath),
    locale: document.documentElement.lang || 'en',
    ...attrib,
    ...firstTouch,
  };
}
