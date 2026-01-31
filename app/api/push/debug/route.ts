import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionCount } from '@/lib/pushStorage';

/**
 * DEBUG endpoint to check push notification storage status
 * Protected by PUSH_ADMIN_SECRET
 */
export async function GET(request: NextRequest) {
  // Check admin secret
  const adminSecret = request.headers.get('x-admin-secret');
  const expectedSecret = process.env.PUSH_ADMIN_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { ok: false, error: 'PUSH_ADMIN_SECRET not configured' },
      { status: 500 }
    );
  }

  if (adminSecret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Check KV configuration
    const kvConfigured = !!(
      process.env.KV_REST_API_URL &&
      process.env.KV_REST_API_TOKEN
    );

    // Determine storage backend
    let storageBackend: 'kv' | 'memory' = 'memory';
    try {
      const kvModule = require('@vercel/kv');
      if (kvModule.kv && kvConfigured) {
        storageBackend = 'kv';
      }
    } catch {
      // KV module not available
    }

    // Get subscription count
    const subscriptionCount = await getSubscriptionCount();

    return NextResponse.json({
      ok: true,
      subscriptionCount,
      storageBackend,
      kvConfigured,
      envVars: {
        KV_REST_API_URL: !!process.env.KV_REST_API_URL,
        KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
        VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
        VAPID_SUBJECT: !!process.env.VAPID_SUBJECT,
        PUSH_ADMIN_SECRET: !!process.env.PUSH_ADMIN_SECRET,
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      },
    });
  } catch (error) {
    console.error('[Push Debug] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
