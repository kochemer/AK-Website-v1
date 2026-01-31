/**
 * Generate VAPID keys for Web Push notifications
 * 
 * Usage: npm run generate-vapid
 * 
 * Outputs:
 * - Public key (NEXT_PUBLIC_VAPID_PUBLIC_KEY)
 * - Private key (VAPID_PRIVATE_KEY)
 * 
 * Copy these to your .env.local and Vercel environment variables
 */

import * as webpush from 'web-push';

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n=== VAPID Keys Generated ===\n');
console.log('Add these to your .env.local file:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:your-email@example.com`);
console.log(`PUSH_ADMIN_SECRET=${generateRandomSecret()}`);
console.log('\n=== Also add to Vercel Environment Variables ===\n');
console.log('1. Go to your Vercel project settings');
console.log('2. Navigate to Environment Variables');
console.log('3. Add all four variables above\n');

/**
 * Generate a random secret for protecting the send endpoint
 */
function generateRandomSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
