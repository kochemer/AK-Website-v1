/**
 * PWA utility functions for detecting standalone mode, iOS Safari, and install prompt availability
 */

/**
 * Detects if the app is running as an installed PWA (standalone mode)
 * 
 * Covers:
 * - iOS: window.navigator.standalone === true
 * - Others: window.matchMedia("(display-mode: standalone)").matches
 * - Also includes display-mode: fullscreen and minimal-ui as acceptable standalone modes
 * 
 * @returns true if running as installed PWA, false otherwise
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // iOS standalone detection
  const isIOSStandalone = (window.navigator as any).standalone === true;
  if (isIOSStandalone) {
    return true;
  }

  // Check display-mode media query (covers standalone, fullscreen, minimal-ui)
  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  const fullscreenQuery = window.matchMedia('(display-mode: fullscreen)');
  const minimalUIQuery = window.matchMedia('(display-mode: minimal-ui)');

  return standaloneQuery.matches || fullscreenQuery.matches || minimalUIQuery.matches;
}

/**
 * Robust detection for iOS Safari (iPhone/iPad/iPod)
 * 
 * Handles edge cases:
 * - iPadOS reporting as Mac (checks for touch support)
 * - Does NOT mis-detect Chrome/Firefox on iOS (checks for Safari specifically)
 * 
 * @returns true if running on iOS Safari, false otherwise
 */
export function isIosSafari(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent;
  const platform = navigator.platform;

  // Basic iOS device detection
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  
  // iPadOS 13+ reports as Mac, so check for touch support and Mac platform
  const isIPadOS = platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  if (!isIOSDevice && !isIPadOS) {
    return false;
  }

  // Ensure it's Safari, not Chrome/Firefox on iOS
  // Chrome on iOS includes "CriOS" in user agent
  // Firefox on iOS includes "FxiOS" in user agent
  // Safari on iOS does NOT include these strings
  const isChromeOnIOS = /CriOS/.test(ua);
  const isFirefoxOnIOS = /FxiOS/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);

  // Return true only if it's Safari (not Chrome/Firefox) on iOS
  return !isChromeOnIOS && !isFirefoxOnIOS && isSafari;
}

/**
 * Checks if the beforeinstallprompt event has been captured and can be used to prompt installation
 * 
 * This should be used in conjunction with storing the event when it fires.
 * The event is only available after beforeinstallprompt has fired and been captured.
 * 
 * @param deferredPrompt - The stored BeforeInstallPromptEvent from beforeinstallprompt listener
 * @returns true if install prompt is available, false otherwise
 */
export function canPromptInstall(deferredPrompt: Event | null): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check if we have a stored prompt event
  if (!deferredPrompt) {
    return false;
  }

  // Verify it has the required methods
  const promptEvent = deferredPrompt as any;
  return typeof promptEvent.prompt === 'function' && 
         typeof promptEvent.userChoice === 'object';
}

/**
 * Gets the display mode for data attribute usage
 * 
 * @returns 'standalone' if in standalone mode, 'browser' otherwise
 */
export function getDisplayMode(): 'standalone' | 'browser' {
  return isStandalone() ? 'standalone' : 'browser';
}
