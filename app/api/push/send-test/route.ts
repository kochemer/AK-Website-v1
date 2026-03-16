import { NextRequest, NextResponse } from 'next/server';
import * as webpush from 'web-push';
import { getAllSubscriptions, removeSubscription } from '@/lib/pushStorage';

/**
 * Test endpoint for sending push notifications
 * 
 * Requires PUSH_ADMIN_SECRET for security
 * 
 * Usage:
 *   GET /api/push/send-test?secret=YOUR_SECRET&limit=5
 *   OR
 *   POST /api/push/send-test
 *   Headers: x-admin-secret: YOUR_SECRET
 *   Body: { limit?: number }
 */

interface SendTestRequestBody {
  limit?: number;
}

export async function POST(request: NextRequest) {
  try {
    // Check admin secret from header only — never from query params
    // (query params appear in server logs, browser history, and CDN access logs)
    const adminSecret = request.headers.get('x-admin-secret');
    
    const expectedSecret = process.env.PUSH_ADMIN_SECRET;
    
    if (!expectedSecret) {
      return NextResponse.json(
        { ok: false, error: 'PUSH_ADMIN_SECRET not configured' },
        { status: 500 }
      );
    }

    if (!adminSecret || adminSecret !== expectedSecret) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check VAPID configuration
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT;

    if (!vapidPrivateKey || !vapidPublicKey || !vapidSubject) {
      return NextResponse.json(
        { ok: false, error: 'VAPID keys not configured. Set VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, and VAPID_SUBJECT' },
        { status: 500 }
      );
    }

    // Configure web-push
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // Get request body for limit
    let limit: number | undefined;
    try {
      const body: SendTestRequestBody = await request.json().catch(() => ({}));
      limit = body.limit;
    } catch {
      // If no body, check query param
      limit = parseInt(new URL(request.url).searchParams.get('limit') || '0') || undefined;
    }

    // Get all subscriptions
    const subscriptions = await getAllSubscriptions();
    
    if (subscriptions.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No subscriptions found',
        sent: 0,
        failed: 0,
      });
    }

    // Limit subscriptions if specified
    const subscriptionsToSend = limit ? subscriptions.slice(0, limit) : subscriptions;

    // Prepare notification payload (matches service worker expectations)
    const payload = JSON.stringify({
      title: 'Test Notification',
      body: 'This is a test push notification from Luxury Intelligence',
      url: '/',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'test',
    });

    // Send notifications
    const results = await Promise.allSettled(
      subscriptionsToSend.map(async (storedSub) => {
        try {
          const subscription = {
            endpoint: storedSub.endpoint,
            keys: {
              p256dh: storedSub.keys.p256dh,
              auth: storedSub.keys.auth,
            },
          };

          await webpush.sendNotification(subscription, payload);
          return { endpoint: storedSub.endpoint, status: 'success' };
        } catch (error: any) {
          // Check if endpoint is gone (410) or invalid
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Remove invalid subscription
            await removeSubscription(storedSub.endpoint);
            return { endpoint: storedSub.endpoint, status: 'removed', reason: 'endpoint invalid' };
          }
          throw error;
        }
      })
    );

    // Count results
    const sent = results.filter(r => r.status === 'fulfilled' && r.value.status === 'success').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const removed = results.filter(r => r.status === 'fulfilled' && r.value.status === 'removed').length;

    return NextResponse.json({
      ok: true,
      message: `Sent ${sent} notifications, ${failed} failed, ${removed} removed`,
      total: subscriptions.length,
      attempted: subscriptionsToSend.length,
      sent,
      failed,
      removed,
    });
  } catch (error) {
    console.error('[Push Send Test] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET intentionally not supported — secrets must not appear in URLs
export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'Use POST with x-admin-secret header' },
    { status: 405 },
  );
}
