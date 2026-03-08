/**
 * Global event properties attached to every analytics event.
 * See measurement-plan.md §4.
 */

import { getLastClickAttribution } from './attribution';

function resolveAppEnv(): string {
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (vercelEnv === 'production') return 'prod';
  if (vercelEnv === 'preview') return 'preview';
  return 'dev';
}

function inferPageType(path: string): string {
  if (path === '/') return 'home';
  if (path.startsWith('/week/')) return 'digest';
  if (path.startsWith('/email-digest')) return 'email_digest';
  if (path.startsWith('/subscribe')) return 'subscribe';
  if (path.startsWith('/archive')) return 'archive';
  if (path.startsWith('/methodology')) return 'methodology';
  if (path.startsWith('/about')) return 'about';
  return 'other';
}

function extractWeekFromPath(path: string): string | null {
  const m = path.match(/\/week\/(\d{4}-W\d{2})/);
  return m ? m[1] : null;
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

  return {
    ...base,
    route_path: routePath,
    page_type: inferPageType(routePath),
    week: extractWeekFromPath(routePath),
    locale: document.documentElement.lang || 'en',
    ...attrib,
  };
}
