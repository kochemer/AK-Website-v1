'use client';

import { useEffect, useState } from 'react';
import { isIosSafari } from '@/lib/pwa';

// Extract VAPID key at module level to ensure Next.js can statically replace it
// This pattern ensures build-time replacement works correctly
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Convert base64url string to Uint8Array
 * Base64url uses - and _ instead of + and /, and no padding
 */
function base64UrlToUint8Array(base64Url: string): BufferSource {
  // Convert base64url to base64
  const base64 = base64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Add padding if needed
  const padding = base64.length % 4;
  const paddedBase64 = padding ? base64 + '='.repeat(4 - padding) : base64;
  
  // Decode base64 to binary string
  const binaryString = atob(paddedBase64);
  
  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}

export default function EnableNotificationsButton() {
  const [isSupported, setIsSupported] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Check if notifications are supported
    const checkSupport = async () => {
      try {
        // Platform checks: Support Chromium-based browsers with Web Push
        // Exclude iOS browsers (Safari/Chrome on iOS don't support Web Push properly)
        
        // Check if Notification API exists
        if (!('Notification' in window)) {
          setIsSupported(false);
          setIsChecking(false);
          return;
        }

        // Check if service worker is supported
        if (!('serviceWorker' in navigator)) {
          setIsSupported(false);
          setIsChecking(false);
          return;
        }

        // Check if PushManager is available (required for Web Push)
        if (!('PushManager' in window)) {
          setIsSupported(false);
          setIsChecking(false);
          return;
        }

        // Exclude iOS browsers (Safari/Chrome on iOS)
        // iOS doesn't properly support Web Push yet
        if (isIosSafari()) {
          setIsSupported(false);
          setIsChecking(false);
          return;
        }

        // Check for iOS Chrome (CriOS) - also exclude
        const ua = navigator.userAgent;
        if (/CriOS/.test(ua) || /FxiOS/.test(ua)) {
          setIsSupported(false);
          setIsChecking(false);
          return;
        }

        // If permission is denied, don't show button
        if (Notification.permission === 'denied') {
          setIsSupported(false);
          setIsChecking(false);
          return;
        }

        // If permission is granted, check if subscription already exists
        if (Notification.permission === 'granted') {
          try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
              // Already subscribed, don't show button
              setIsSupported(false);
              setIsChecking(false);
              return;
            }
            // Permission granted but no subscription - show button to subscribe
          } catch (e) {
            // If check fails, still show button
          }
        }

        // Check if VAPID key is configured (use module-level constant)
        if (!VAPID_PUBLIC_KEY) {
          setIsSupported(false);
          setIsChecking(false);
          return;
        }

        setIsSupported(true);
      } catch (error) {
        setIsSupported(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkSupport();
  }, []);

  const handleSubscribe = async () => {
    if (typeof window === 'undefined') {
      return;
    }

    // DEBUG: Log SW controller state
    console.log('[PUSH DEBUG] Button clicked');
    console.log('[PUSH DEBUG] SW controller:', navigator.serviceWorker.controller ? 'exists' : 'null');
    console.log('[PUSH DEBUG] SW ready check starting...');

    setIsSubscribing(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      // Request notification permission
      console.log('[PUSH DEBUG] Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('[PUSH DEBUG] Permission result:', permission);
      
      if (permission !== 'granted') {
        console.log('[PUSH DEBUG] Permission denied, aborting');
        setStatus('error');
        setErrorMessage('Notification permission denied');
        setIsSubscribing(false);
        return;
      }

      // Get service worker registration
      console.log('[PUSH DEBUG] Waiting for service worker ready...');
      const startTime = Date.now();
      const registration = await navigator.serviceWorker.ready;
      const readyTime = Date.now() - startTime;
      console.log('[PUSH DEBUG] SW ready after', readyTime, 'ms');
      console.log('[PUSH DEBUG] Registration state:', {
        active: registration.active?.state,
        waiting: registration.waiting?.state,
        installing: registration.installing?.state,
      });

      // Check if already subscribed
      console.log('[PUSH DEBUG] Checking existing subscription...');
      let subscription = await registration.pushManager.getSubscription();
      console.log('[PUSH DEBUG] Existing subscription:', subscription ? 'found' : 'none');
      
      if (!subscription) {
        // Get VAPID public key (use module-level constant)
        console.log('[PUSH DEBUG] VAPID key present:', !!VAPID_PUBLIC_KEY);
        console.log('[PUSH DEBUG] VAPID key length:', VAPID_PUBLIC_KEY?.length || 0);
        if (!VAPID_PUBLIC_KEY) {
          throw new Error('VAPID public key not configured');
        }

        // Convert base64url to Uint8Array
        console.log('[PUSH DEBUG] Converting VAPID key...');
        const applicationServerKey = base64UrlToUint8Array(VAPID_PUBLIC_KEY);
        console.log('[PUSH DEBUG] Key converted, length:', applicationServerKey.byteLength);

        // Subscribe to push
        console.log('[PUSH DEBUG] Calling pushManager.subscribe...');
        const subscribeStart = Date.now();
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
        const subscribeTime = Date.now() - subscribeStart;
        console.log('[PUSH DEBUG] Subscribe completed after', subscribeTime, 'ms');
        console.log('[PUSH DEBUG] Subscription endpoint:', subscription.endpoint.substring(0, 50) + '...');
      }

      // Prepare subscription data
      console.log('[PUSH DEBUG] Preparing subscription data...');
      const subscriptionData: PushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(
            String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))
          ),
          auth: btoa(
            String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))
          ),
        },
      };
      console.log('[PUSH DEBUG] Subscription data prepared');

      // Send subscription to server
      console.log('[PUSH DEBUG] POST /api/push/subscribe starting...');
      const fetchStart = Date.now();
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscriptionData,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });
      const fetchTime = Date.now() - fetchStart;
      console.log('[PUSH DEBUG] POST completed after', fetchTime, 'ms');
      console.log('[PUSH DEBUG] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('[PUSH DEBUG] Response error:', errorText);
        throw new Error('Failed to save subscription');
      }

      const result = await response.json();
      console.log('[PUSH DEBUG] Response JSON:', result);
      if (result.ok) {
        console.log('[PUSH DEBUG] Subscription successful, updating UI');
        setStatus('success');
        setIsSupported(false); // Hide button after successful subscription
      } else {
        throw new Error('Subscription failed');
      }
    } catch (error) {
      console.error('[PUSH DEBUG] Error caught:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Subscription failed');
    } finally {
      console.log('[PUSH DEBUG] Finally block, setting isSubscribing=false');
      setIsSubscribing(false);
    }
  };

  // Don't render during SSR or while checking
  if (typeof window === 'undefined' || isChecking) {
    return null;
  }

  // Don't show if not supported or already subscribed
  // (Platform checks already handled in checkSupport - iOS will return null here)
  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleSubscribe}
        disabled={isSubscribing}
        className="text-[10px] md:text-xs font-medium text-gray-700 hover:text-gray-900 px-2 py-1.5 md:px-2.5 md:py-1 rounded transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 min-h-[36px] md:min-h-0 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Enable notifications"
      >
        {isSubscribing ? 'Enabling...' : 'Enable notifications'}
      </button>
      {status === 'success' && (
        <span className="text-[10px] md:text-xs text-green-600">✓ Enabled</span>
      )}
      {status === 'error' && (
        <span className="text-[10px] md:text-xs text-red-600" title={errorMessage}>
          ✗ Failed
        </span>
      )}
    </div>
  );
}
