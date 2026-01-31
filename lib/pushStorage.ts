/**
 * Persistent subscription storage for Web Push
 * 
 * Uses Vercel KV if available, otherwise falls back to in-memory Map (dev only)
 */

let kv: any = null;
try {
  // Try to import @vercel/kv (may not be available)
  const kvModule = require('@vercel/kv');
  kv = kvModule.kv;
} catch (error) {
  // @vercel/kv not available, will use in-memory fallback
}

export interface StoredSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: string;
}

// In-memory fallback storage (dev only - data lost on restart)
// WARNING: This is only used when Vercel KV is not configured
// In production, ensure KV_REST_API_URL, KV_REST_API_TOKEN, and KV_REST_API_READ_ONLY_TOKEN are set
const inMemoryStorage = new Map<string, StoredSubscription>();

/**
 * Check if Vercel KV is available
 */
function isKvAvailable(): boolean {
  return !!(
    kv &&
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN
  );
}

/**
 * Store a subscription (deduplicated by endpoint)
 */
export async function storeSubscription(subscription: StoredSubscription): Promise<void> {
  if (isKvAvailable()) {
    try {
      // Use endpoint as the key (deduplication)
      await kv.set(`push:subscription:${subscription.endpoint}`, subscription);
    } catch (error) {
      console.error('[Push Storage] KV error:', error);
      throw error;
    }
  } else {
    // Fallback to in-memory storage (dev only)
    console.warn(
      '[Push Storage] WARNING: Vercel KV not configured. Using in-memory storage (data lost on restart).'
    );
    inMemoryStorage.set(subscription.endpoint, subscription);
  }
}

/**
 * Get all stored subscriptions
 */
export async function getAllSubscriptions(): Promise<StoredSubscription[]> {
  if (isKvAvailable()) {
    try {
      // Get all subscription keys
      const keys = await kv.keys('push:subscription:*');
      
      // Fetch all subscriptions
      const subscriptions = await Promise.all(
        keys.map(async (key: string) => {
          const sub = await kv.get(key) as StoredSubscription | null;
          return sub;
        })
      );
      
      // Filter out null values and return
      return subscriptions.filter((sub): sub is StoredSubscription => sub !== null);
    } catch (error) {
      console.error('[Push Storage] KV error:', error);
      return [];
    }
  } else {
    // Fallback to in-memory storage
    return Array.from(inMemoryStorage.values());
  }
}

/**
 * Remove a subscription by endpoint
 */
export async function removeSubscription(endpoint: string): Promise<void> {
  if (isKvAvailable()) {
    try {
      await kv.del(`push:subscription:${endpoint}`);
    } catch (error) {
      console.error('[Push Storage] KV error:', error);
      throw error;
    }
  } else {
    // Fallback to in-memory storage
    inMemoryStorage.delete(endpoint);
  }
}

/**
 * Get subscription count
 */
export async function getSubscriptionCount(): Promise<number> {
  if (isKvAvailable()) {
    try {
      const keys = await kv.keys('push:subscription:*');
      return keys.length;
    } catch (error) {
      console.error('[Push Storage] KV error:', error);
      return 0;
    }
  } else {
    return inMemoryStorage.size;
  }
}
