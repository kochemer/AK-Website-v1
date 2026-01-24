'use client';

import { useEffect } from 'react';
import { getDisplayMode } from '@/lib/pwa';

/**
 * Sets data-display-mode attribute on the html element
 * This allows CSS to style differences between standalone and browser modes
 */
export default function DisplayModeAttribute() {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const htmlElement = document.documentElement;
      const displayMode = getDisplayMode();
      htmlElement.setAttribute('data-display-mode', displayMode);
    }
  }, []);

  return null;
}
