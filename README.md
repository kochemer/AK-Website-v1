# AK-Website-v1

First repository for the AK website

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## How to refresh the weekly digest (manual)

1. **Run ingestion**
    ```bash
    npm run ingest
    ```
2. **Build weekly digest**
    ```bash
    npx tsx scripts/buildWeeklyDigest.ts
    ```
3. **Commit & push**
    ```bash
    git add .
    git commit -m "Update articles and weekly digest"
    git push
    ```
4. **Vercel deploys automatically**

## Podcast Generation

To generate a weekly podcast:

```bash
npm run podcast -- --week=2026-W02 --voice=alloy --music=on
```

### FFmpeg Setup (for background music)

The podcast script supports background music mixing, which requires FFmpeg. You can set it up in one of three ways:

1. **Bundled FFmpeg (Recommended)**: Place FFmpeg executables in `tools/ffmpeg/`:
   - Windows: `tools/ffmpeg/ffmpeg.exe` and `tools/ffmpeg/ffprobe.exe`
   - Mac/Linux: `tools/ffmpeg/ffmpeg` and `tools/ffmpeg/ffprobe`
   - See `tools/ffmpeg/README.md` for download instructions

2. **Environment Variable**: Set `FFMPEG_PATH` to point to your FFmpeg executable:
   ```bash
   # Windows PowerShell
   $env:FFMPEG_PATH = "C:\path\to\ffmpeg.exe"
   
   # Mac/Linux
   export FFMPEG_PATH="/usr/local/bin/ffmpeg"
   ```

3. **System PATH**: Install FFmpeg globally and ensure it's in your system PATH

The script will check these locations in order. If FFmpeg is not found, the podcast will still be generated without background music.

## Learn More

To learn more about Next.js, take a look at:

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

## PWA & Offline Support

This app includes Progressive Web App (PWA) support with offline fallback functionality.

### Testing Offline Mode

To test offline functionality in Chrome DevTools:

1. **Build the production app:**
   ```bash
   npm run build
   npm run start
   ```

2. **Open Chrome DevTools:**
   - Press `F12` or right-click → Inspect
   - Go to the **Network** tab
   - Check the **Offline** checkbox (or select "Offline" from the throttling dropdown)

3. **Test offline behavior:**
   - Navigate to a page you've already visited (it should load from cache)
   - Navigate to a new page (you should see the offline fallback page at `/offline.html`)
   - Click the "Retry" button to attempt reloading

4. **Clear cache if needed:**
   - DevTools → **Application** tab → **Storage** → **Clear site data**
   - Or: DevTools → **Application** → **Cache Storage** → Right-click → Delete

### Caching Strategy

- **HTML/Navigation requests**: Network-first (tries network, falls back to cache, then offline.html)
- **Static assets** (JS, CSS, images, fonts): Cache-first (serves from cache immediately)
- **Offline fallback**: Shows `/offline.html` when network fails and page isn't cached

### Testing PWA Install UI

**Chrome Desktop:**
1. Build and start the production app:
   ```bash
   npm run build
   npm run start
   ```
2. Open Chrome DevTools → **Application** tab → **Manifest**
3. Click **Add to homescreen** button (or use the "Install app" button in the header)
4. Verify the install prompt appears and works correctly
5. After installation, the install button should disappear

**iOS Safari:**
1. Open the site in Safari on iPhone/iPad
2. Verify the "Add to Home Screen" instruction text appears in the header (next to language switcher)
3. The text should say: "Add to Home Screen: Share → Add to Home Screen"
4. Follow the instructions to manually add to home screen
5. After adding, the instruction text should disappear on subsequent visits

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use [Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

See [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
