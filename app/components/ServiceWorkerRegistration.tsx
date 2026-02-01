'use client';

import { useEffect } from 'react';

/**
 * Service Worker Registration Component
 * 
 * Manually registers the service worker since next-pwa's auto-registration
 * may not be working properly in Next.js 16.
 * 
 * This component runs only on the client and registers /sw.js
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') {
      return;
    }

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Only register in production (next-pwa disables in dev)
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    // Register the service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW Registration] Service worker registered:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('[SW Registration] New service worker activated');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[SW Registration] Service worker registration failed:', error);
      });
  }, []);

  return null; // This component doesn't render anything
}
