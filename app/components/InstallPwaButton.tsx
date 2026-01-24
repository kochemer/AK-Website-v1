'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInStandaloneMode = (window.navigator as any).standalone === true;
      
      if (isStandalone || isInStandaloneMode) {
        setIsInstalled(true);
        return;
      }

      // Listen for beforeinstallprompt event (Chrome/Edge)
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // Detect iOS Safari (not standalone)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const isIOSStandalone = (window.navigator as any).standalone === true;
      
      if (isIOS && isSafari && !isIOSStandalone) {
        setShowIOSPrompt(true);
      }

      // Listen for appinstalled event
      const handleAppInstalled = () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
        setShowIOSPrompt(false);
      };

      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
  };

  // Don't render if already installed
  if (isInstalled) {
    return null;
  }

  // Show iOS prompt
  if (showIOSPrompt) {
    return (
      <div className="flex items-center">
        <span className="text-[10px] md:text-xs text-gray-600 whitespace-nowrap">
          Add to Home Screen: <span className="font-medium">Share</span> → <span className="font-medium">Add to Home Screen</span>
        </span>
      </div>
    );
  }

  // Show install button for Chrome/Edge
  if (deferredPrompt) {
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
