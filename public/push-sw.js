// Web Push event handlers for next-pwa service worker
// This file is imported via importScripts in the generated service worker

// Handle incoming push notifications
self.addEventListener('push', function(event) {
  let notificationData = {
    title: 'Luxury Intelligence',
    body: 'You have a new update',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'default',
    data: {
      url: '/'
    }
  };

  // Parse JSON payload if present
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        tag: payload.tag || notificationData.tag,
        data: {
          url: payload.url || payload.data?.url || notificationData.data.url
        }
      };
    } catch (e) {
      // If JSON parsing fails, try text
      const text = event.data.text();
      if (text) {
        notificationData.body = text;
      }
    }
  }

  // Show notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data
    })
  );
});

// Append UTM parameters to an internal URL for attribution tracking.
// utm_campaign is sourced from the notification tag (e.g. the week label).
function addPushUtms(url, tag) {
  try {
    const base = url.startsWith('/') ? self.location.origin + url : url;
    const u = new URL(base);
    u.searchParams.set('utm_source', 'web_push');
    u.searchParams.set('utm_medium', 'push');
    if (tag && tag !== 'default') {
      u.searchParams.set('utm_campaign', tag);
    }
    // Return absolute URL so openWindow works correctly
    return u.toString();
  } catch {
    return url;
  }
}

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const rawUrl = event.notification.data?.url || '/';
  const tag = event.notification.tag || 'default';
  const targetUrl = addPushUtms(rawUrl, tag);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // Match on the raw path (without UTMs) so existing tabs are reused correctly
        const rawAbsolute = rawUrl.startsWith('/') ? self.location.origin + rawUrl : rawUrl;
        if (client.url.startsWith(rawAbsolute.split('?')[0]) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no matching window found, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
