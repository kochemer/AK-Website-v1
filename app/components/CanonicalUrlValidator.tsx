/**
 * Runtime validator for canonical URLs in production
 * Logs errors if canonical URLs don't match expected format
 */

'use client';

import { useEffect } from 'react';
import { getSiteUrl } from '@/lib/utils/siteUrl';

export default function CanonicalUrlValidator() {
  useEffect(() => {
    // Only run in production
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    const siteUrl = getSiteUrl();
    const expectedCanonical = `${siteUrl}/`;

    // Find canonical link element
    const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    
    if (!canonicalLink) {
      console.error('[CanonicalUrlValidator] ❌ No canonical link found in document');
      return;
    }

    const actualCanonical = canonicalLink.href;

    // Validate canonical URL
    if (!actualCanonical.startsWith(siteUrl)) {
      console.error(
        `[CanonicalUrlValidator] ❌ Canonical URL does not start with siteUrl:\n` +
        `  Expected: ${expectedCanonical}\n` +
        `  Actual: ${actualCanonical}\n` +
        `  siteUrl: ${siteUrl}`
      );
    }

    if (!actualCanonical.startsWith('https://')) {
      console.error(
        `[CanonicalUrlValidator] ❌ Canonical URL is not absolute HTTPS: ${actualCanonical}`
      );
    }

    if (actualCanonical.includes('vercel.app')) {
      console.error(
        `[CanonicalUrlValidator] ❌ Canonical URL contains vercel.app domain: ${actualCanonical}`
      );
    }

    if (actualCanonical !== expectedCanonical) {
      console.warn(
        `[CanonicalUrlValidator] ⚠️  Canonical URL does not match expected:\n` +
        `  Expected: ${expectedCanonical}\n` +
        `  Actual: ${actualCanonical}`
      );
    } else {
      console.log(`[CanonicalUrlValidator] ✅ Canonical URL is correct: ${actualCanonical}`);
    }
  }, []);

  return null; // This component doesn't render anything
}
