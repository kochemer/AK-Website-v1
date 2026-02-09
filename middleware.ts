import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for URL normalization and canonical host enforcement:
 * - Redirect www.luxury-intel.com -> luxury-intel.com (308 permanent)
 * - Redirect /index.html -> / (308 permanent)
 * - Normalize trailing slash: remove trailing slash except for root "/" (308)
 * - Strip tracking query params: utm_*, gclid, fbclid (308 redirect to same path without them)
 * - Preserve path and remaining query params
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  let needsRedirect = false;

  // 1. Handle www to non-www redirect
  const hostname = request.headers.get('host') || '';
  let targetHost = hostname;
  if (hostname.startsWith('www.')) {
    targetHost = hostname.replace(/^www\./, '');
    needsRedirect = true;
  }

  // 2. Redirect /index.html to /
  let targetPath = url.pathname;
  if (url.pathname === '/index.html') {
    targetPath = '/';
    needsRedirect = true;
  }

  // 3. Normalize trailing slash: remove trailing slash except for root "/"
  if (targetPath.endsWith('/') && targetPath !== '/') {
    targetPath = targetPath.slice(0, -1);
    needsRedirect = true;
  }

  // 4. Strip tracking query params: utm_*, gclid, fbclid
  const trackingParams = ['gclid', 'fbclid'];
  const utmParams: string[] = [];
  
  url.searchParams.forEach((value, key) => {
    if (key.startsWith('utm_')) {
      utmParams.push(key);
    }
  });

  const hasTrackingParams = trackingParams.some(p => url.searchParams.has(p)) || utmParams.length > 0;

  // Build new URL with all changes if any redirect is needed
  if (needsRedirect || hasTrackingParams) {
    const protocol = request.nextUrl.protocol;
    const newUrl = new URL(`${protocol}//${targetHost}${targetPath}`);
    
    // Copy non-tracking params only
    url.searchParams.forEach((value, key) => {
      if (!key.startsWith('utm_') && !trackingParams.includes(key)) {
        newUrl.searchParams.set(key, value);
      }
    });
    
    return NextResponse.redirect(newUrl, { status: 308 });
  }

  // No redirect needed, continue
  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)).*)',
  ],
};
