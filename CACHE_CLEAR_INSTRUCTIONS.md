# Cache Clear Instructions - Home Page Showing Wrong Week

## Problem
The home page is showing week 3 instead of week 4, even though the code is correctly set to `'2026-W04'`.

## Root Cause
This is a **caching issue**. The PWA service worker caches HTML pages for 24 hours, and your browser may also be caching the old page.

## Solution Steps

### 1. Clear Service Worker Cache (PWA)
1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Click **Service Workers** in the left sidebar
4. Find the service worker for your site
5. Click **Unregister** to remove it
6. Go to **Storage** → **Clear site data**
7. Check all boxes and click **Clear site data**

### 2. Hard Refresh Browser
- **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

### 3. Restart Dev Server (if running)
```bash
# Stop the current dev server (Ctrl+C)
# Then restart:
npm run dev
```

### 4. Verify the Fix
1. Open the site in an **Incognito/Private window**
2. Navigate to the home page
3. You should now see **Week 2026-W04**

## Verification
The code is correctly set:
- ✅ `app/page.tsx` line 183: `const weekLabel = '2026-W04';`
- ✅ `data/digests/2026-W04.json` exists with correct weekLabel
- ✅ Build cache has been cleared (`.next` directory removed and rebuilt)

## If Still Not Working
1. Check if you're viewing the correct URL (localhost:3000 vs production)
2. Try a different browser
3. Check browser console for any errors
4. Verify the dev server is running the latest code
