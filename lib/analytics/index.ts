/**
 * Thin analytics facade.
 * Enriches every event with global props, gates on consent, forwards to Amplitude.
 */

import * as amplitude from '@amplitude/unified';
import { getGlobalEventProps } from './context';
import { getAnalyticsConsent } from './consent';

export type { LastClickAttribution } from './attribution';
export { getLastClickAttribution } from './attribution';
export { getGlobalEventProps } from './context';
export { getAnalyticsConsent, setAnalyticsConsent } from './consent';
export type { ConsentValue } from './consent';

const isDev = process.env.NODE_ENV === 'development';
const isPreview = process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview';

export function track(
  eventName: string,
  props?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;

  if (!getAnalyticsConsent()) return;

  const payload: Record<string, unknown> = {
    ...getGlobalEventProps(),
    ...(props || {}),
  };

  if (isDev || isPreview) {
    // eslint-disable-next-line no-console
    console.log('[analytics]', eventName, payload);
  }

  if (!process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY && !isDev) return;

  try {
    amplitude.track(eventName, payload);
  } catch {
    // Amplitude may not be initialized yet — silently ignore
  }
}
