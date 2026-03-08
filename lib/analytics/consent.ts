/**
 * Lightweight analytics consent plumbing.
 *
 * Stores user choice in localStorage so track() can gate on it.
 * A full consent banner UI will be built later — this is just the read/write layer.
 *
 * Dev convenience: in development, consent is auto-granted so events
 * show up in the console without needing a banner.
 */

const STORAGE_KEY = 'li_analytics_consent_v1';

export type ConsentValue = 'granted' | 'denied';

export function getAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;

  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored === 'granted') return true;
  if (stored === 'denied') return false;

  // Dev auto-grant: set consent to granted automatically in development
  // so track() works out of the box while testing.
  if (process.env.NODE_ENV === 'development') {
    localStorage.setItem(STORAGE_KEY, 'granted');
    return true;
  }

  return false;
}

export function setAnalyticsConsent(value: ConsentValue): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, value);
}
