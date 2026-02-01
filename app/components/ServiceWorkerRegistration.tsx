'use client';

import { useEffect } from 'react';

/**
 * Service Worker Registration Component
 * 
 * Manually registers the service worker since next-pwa's auto-registration
 * may not be working properly in Next.js 16.
 * 
 * This component runs only on the client and registers /sw.js
 * 
 * Note: If you see "bad-precaching-response" errors in the console, this is usually
 * due to a stale precache manifest from a previous build. The next deployment
 * will generate a fresh manifest and resolve the issue automatically.
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

    // Check for existing registrations that might be stuck
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      // Unregister any stuck service workers (e.g., ones failing to install due to 404s)
      registrations.forEach((registration) => {
        if (registration.active) {
          // Check if the active worker is in a bad state
          registration.update().catch(() => {
            // If update fails, the worker might be stuck - unregister it
            console.warn('[SW Registration] Detected stuck service worker, unregistering...');
            registration.unregister();
          });
        }
      });
    });

    // Register the service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW Registration] Service worker registered:', registration.scope);
        
        // Monitor installation state
        if (registration.installing) {
          registration.installing.addEventListener('statechange', () => {
            if (registration.installing?.state === 'redundant') {
              console.warn('[SW Registration] Service worker installation failed (likely due to precaching errors)');
              console.warn('[SW Registration] This usually resolves after the next deployment');
            }
          });
        }
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('[SW Registration] New service worker activated');
              } else if (newWorker.state === 'redundant') {
                console.warn('[SW Registration] New service worker failed to install');
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
