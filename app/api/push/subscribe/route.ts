import { NextRequest, NextResponse } from 'next/server';
import { storeSubscription, StoredSubscription } from '@/lib/pushStorage';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface SubscribeRequestBody {
  subscription: PushSubscription;
  userAgent?: string;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SubscribeRequestBody = await request.json();

    // Validate subscription object
    if (!body.subscription) {
      return NextResponse.json(
        { ok: false, error: 'Missing subscription object' },
        { status: 400 }
      );
    }

    const { subscription } = body;

    // Validate subscription has required fields
    if (!subscription.endpoint) {
      return NextResponse.json(
        { ok: false, error: 'Missing subscription.endpoint' },
        { status: 400 }
      );
    }

    if (!subscription.keys) {
      return NextResponse.json(
        { ok: false, error: 'Missing subscription.keys' },
        { status: 400 }
      );
    }

    if (!subscription.keys.p256dh || !subscription.keys.auth) {
      return NextResponse.json(
        { ok: false, error: 'Missing subscription.keys.p256dh or subscription.keys.auth' },
        { status: 400 }
      );
    }

    // Prepare subscription for storage
    const storedSubscription: StoredSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userAgent: body.userAgent,
      createdAt: body.timestamp || new Date().toISOString(),
    };

    // Store subscription (deduplicated by endpoint)
    await storeSubscription(storedSubscription);

    // Log subscription (server-side)
    console.log('[Push Subscribe] Subscription stored:', {
      endpoint: subscription.endpoint,
      userAgent: body.userAgent || 'unknown',
      timestamp: storedSubscription.createdAt,
      // Don't log keys for security
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Push Subscribe] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
