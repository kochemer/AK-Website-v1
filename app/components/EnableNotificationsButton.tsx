'use client';

import { useEffect, useState } from 'react';
import { isIosSafari } from '@/lib/pwa';

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

        // Check if VAPID key is configured
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
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

    setIsSubscribing(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        setStatus('error');
        setErrorMessage('Notification permission denied');
        setIsSubscribing(false);
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Get VAPID public key
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          throw new Error('VAPID public key not configured');
        }

        // Convert base64url to Uint8Array
        const applicationServerKey = base64UrlToUint8Array(vapidPublicKey);

        // Subscribe to push
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // Prepare subscription data
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

      // Send subscription to server
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

      if (!response.ok) {
        throw new Error('Failed to save subscription');
      }

      const result = await response.json();
      if (result.ok) {
        setStatus('success');
        setIsSupported(false); // Hide button after successful subscription
      } else {
        throw new Error('Subscription failed');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Subscription failed');
    } finally {
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
