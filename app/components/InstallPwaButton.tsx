'use client';

import { useEffect, useState } from 'react';
import { isStandalone, isIosSafari, canPromptInstall } from '@/lib/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDetected, setIsDetected] = useState(false); // Track when detection is complete

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Check if already installed (standalone mode) - early return
    if (isStandalone()) {
      setIsInstalled(true);
      setIsDetected(true);
      return;
    }

    // Listen for beforeinstallprompt event (Chrome/Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsDetected(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detect iOS Safari (not standalone) - only show if not already installed
    if (isIosSafari() && !isStandalone()) {
      setShowIOSPrompt(true);
      setIsDetected(true);
    } else {
      // If not iOS Safari, mark as detected (we're waiting for beforeinstallprompt or nothing to show)
      setIsDetected(true);
    }

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowIOSPrompt(false);
      setIsDetected(true);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!canPromptInstall(deferredPrompt) || !deferredPrompt) {
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstalled(true);
        setShowIOSPrompt(false);
      }
    } catch (error) {
      // Handle any errors silently
      console.error('Install prompt error:', error);
    }
  };

  // Avoid flicker: render null until detection is complete
  if (!isDetected) {
    return null;
  }

  // Don't render if already installed
  if (isInstalled || isStandalone()) {
    return null;
  }

  // Show iOS prompt (only if not standalone)
  if (showIOSPrompt && isIosSafari() && !isStandalone()) {
    return (
      <div className="flex items-center">
        <span className="text-[10px] md:text-xs text-gray-600 whitespace-nowrap">
          Add to Home Screen: <span className="font-medium">Share</span> → <span className="font-medium">Add to Home Screen</span>
        </span>
      </div>
    );
  }

  // Show install button for Chrome/Edge (only if prompt is available)
  if (canPromptInstall(deferredPrompt) && deferredPrompt) {
    return (
      <button
        onClick={handleInstallClick}
        className="text-[10px] md:text-xs font-medium text-gray-700 hover:text-gray-900 px-2 py-1.5 md:px-2.5 md:py-1 rounded transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 min-h-[36px] md:min-h-0 flex items-center"
        aria-label="Install app"
      >
        Install app
      </button>
    );
  }

  // Don't render anything if install is not available
  return null;
}
