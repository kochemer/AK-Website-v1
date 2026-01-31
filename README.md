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

## How to refresh the monthly digest (manual)

1. **Run ingestion**
    ```bash
    npm run ingest:pages
    ```
2. **Build monthly digest**
    ```bash
    npm run build:digest
    ```
3. **Commit & push**
    ```bash
    git add .
    git commit -m "Update articles and monthly digest"
    git push
    ```
4. **Vercel deploys automatically**

## Learn More

To learn more about Next.js, take a look at:

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use [Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

See [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Web Push Notifications

### Setup

1. **Generate VAPID keys:**
   ```bash
   npm run generate-vapid
   ```
   This will output public and private keys, plus a random admin secret.

2. **Set environment variables locally (`.env.local`):**
   ```bash
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public-key-from-step-1>
   VAPID_PRIVATE_KEY=<private-key-from-step-1>
   VAPID_SUBJECT=mailto:your-email@example.com
   PUSH_ADMIN_SECRET=<random-secret-from-step-1>
   ```

3. **Set environment variables on Vercel:**
   - Go to your Vercel project → Settings → Environment Variables
   - Add all four variables from step 2
   - For production, also add Vercel KV variables (if using KV storage):
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN`
     - `KV_REST_API_READ_ONLY_TOKEN`

4. **Subscribe on Android/Chrome:**
   - Open the site on Android Chrome (or desktop Chrome)
   - Click "Enable notifications" button in the header
   - Grant notification permission when prompted
   - Subscription is automatically saved

5. **Test push notification:**
   ```bash
   # Using curl (replace YOUR_SECRET with your PUSH_ADMIN_SECRET)
   curl -X POST "http://localhost:3000/api/push/send-test" \
     -H "x-admin-secret: YOUR_SECRET" \
     -H "Content-Type: application/json"
   
   # Or with query param
   curl "http://localhost:3000/api/push/send-test?secret=YOUR_SECRET&limit=5"
   ```
   
   On production:
   ```bash
   curl -X POST "https://luxury-intel.com/api/push/send-test" \
     -H "x-admin-secret: YOUR_SECRET"
   ```

6. **Verify notification arrives:**
   - Check that the notification appears on your Android device
   - Click the notification to verify it opens the correct URL
   - Check server logs for send results

### Storage

- **Production:** Uses Vercel KV (if configured) for persistent storage
- **Development:** Falls back to in-memory Map (data lost on restart)
- Subscriptions are deduplicated by endpoint

### Service Worker

The service worker handles push events and notification clicks:
- Push payload fields: `title`, `body`, `url`, `icon`, `badge`, `tag`
- Notification click opens the URL specified in payload
- Handlers are defined in `public/push-sw.js`

<!-- trigger build -->
trigger rebuild
