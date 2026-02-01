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

    // Unregister all existing service workers and clear caches for a fresh start
    const cleanupAndRegister = async () => {
      try {
        // Get all existing registrations
        const registrations = await navigator.serviceWorker.getRegistrations();
        
        // Unregister all existing service workers
        for (const registration of registrations) {
          console.log('[SW Registration] Unregistering existing service worker...');
          await registration.unregister();
        }
        
        // Clear all caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          console.log('[SW Registration] Clearing', cacheNames.length, 'caches...');
          await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        }
        
        // Small delay to ensure cleanup completes
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Now register fresh
        registerServiceWorker();
      } catch (error) {
        console.error('[SW Registration] Cleanup failed:', error);
        // Still try to register even if cleanup fails
        registerServiceWorker();
      }
    };
    
    const registerServiceWorker = () => {

      // Register the service worker with updateViaCache: 'none' to bypass HTTP cache
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((registration) => {
          console.log('[SW Registration] Service worker registered:', registration.scope);
          
          // Monitor installation state immediately
          const checkInstallation = () => {
            if (registration.installing) {
              registration.installing.addEventListener('statechange', () => {
                if (registration.installing?.state === 'redundant') {
                  console.warn('[SW Registration] Service worker installation failed - unregistering and retrying...');
                  // Unregister and retry after a delay
                  registration.unregister().then(() => {
                    setTimeout(() => {
                      cleanupAndRegister();
                    }, 2000);
                  });
                } else if (registration.installing?.state === 'activated') {
                  console.log('[SW Registration] Service worker activated successfully');
                }
              });
            } else if (registration.waiting) {
              // If there's a waiting worker, skip waiting
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          };
          
          checkInstallation();
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  console.log('[SW Registration] New service worker activated');
                } else if (newWorker.state === 'redundant') {
                  console.warn('[SW Registration] New service worker failed to install - will retry on next page load');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('[SW Registration] Service worker registration failed:', error);
        });
    };
    
    // Start the cleanup and registration process
    cleanupAndRegister();
  }, []);

  return null; // This component doesn't render anything
}
