import { NextRequest, NextResponse } from 'next/server';
import { storeSubscription, StoredSubscription } from '@/lib/pushStorage';

// Allowed origins for push subscription requests
const ALLOWED_ORIGINS = [
  'https://luxury-intel.com',
  'https://www.luxury-intel.com',
  // Allow localhost in development
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
];

// Known push service endpoint domains — browsers can only create subscriptions
// via these services, so any other endpoint domain is invalid/spoofed.
const ALLOWED_PUSH_ENDPOINT_HOSTS = [
  'fcm.googleapis.com',          // Chrome / Android
  'updates.push.services.mozilla.com', // Firefox
  'push.services.mozilla.com',   // Firefox (legacy)
  'web.push.apple.com',          // Safari / iOS
  'push.apple.com',              // Apple (alt)
  'fcm.googleapis.com',          // Chrome desktop
  'push.googleapis.com',         // Google (alt)
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return ALLOWED_PUSH_ENDPOINT_HOSTS.some(
      host => url.hostname === host || url.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

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
  // Validate Origin header — only accept requests from our own domain
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json(
      { ok: false, error: 'Forbidden' },
      { status: 403 }
    );
  }

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

    // Validate endpoint comes from a known browser push service
    if (!isAllowedPushEndpoint(subscription.endpoint)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid subscription endpoint' },
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

    await storeSubscription(storedSubscription);

    console.log('[Push Subscribe] Subscription stored:', {
      userAgent: body.userAgent || 'unknown',
      timestamp: storedSubscription.createdAt,
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
