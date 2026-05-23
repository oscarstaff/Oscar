// Nexus Service Worker — push notifications + offline cache + cross-device sync
const CACHE_NAME = 'nexus-v2';
const CORE_ASSETS = [
  './',
  './index.html'
];

// Install: cache core assets + skip waiting so new SW activates immediately
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CORE_ASSETS).catch(function() {});
    })
  );
});

// Activate: clean old caches + claim all clients
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Fetch: network-first for HTML, cache-fallback
self.addEventListener('fetch', function(event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.url.indexOf('supabase.co') >= 0 || req.url.indexOf('googleapis.com') >= 0) return;
  if (req.url.indexOf('script.google.com') >= 0) return;
  if (req.url.indexOf('jsdelivr.net') >= 0) return;
  
  event.respondWith(
    fetch(req).then(function(resp) {
      if ((resp.ok && req.url.endsWith('.html')) || req.url.endsWith('/')) {
        const respClone = resp.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(req, respClone); });
      }
      return resp;
    }).catch(function() {
      return caches.match(req);
    })
  );
});

// ═══════════════════════════════════════════════════════════════
// PUSH — supports visible notifications + silent dismiss commands
// ═══════════════════════════════════════════════════════════════
self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Nexus', body: event.data ? event.data.text() : 'New notification' };
  }
  
  // ── SILENT DISMISS ── another device marked it read
  if (data.action === 'dismiss' && data.notif_key) {
    event.waitUntil(
      self.registration.getNotifications().then(function(notifications) {
        let closed = 0;
        notifications.forEach(function(n) {
          const tagMatch = (n.tag === data.notif_key);
          const dataMatch = (n.data && n.data.notif_key === data.notif_key);
          if (tagMatch || dataMatch) {
            n.close();
            closed++;
          }
        });
        console.log('[sw] dismissed', closed, 'for', data.notif_key);
        // Tell any open tab to refresh badges
        return self.clients.matchAll({ type: 'window' }).then(function(clients) {
          clients.forEach(function(c) {
            c.postMessage({ type: 'remote-dismiss', notif_key: data.notif_key });
          });
        });
      })
    );
    return;
  }
  
  // ── BULK DISMISS ──
  if (data.action === 'dismiss_all') {
    event.waitUntil(
      self.registration.getNotifications().then(function(notifications) {
        notifications.forEach(function(n) { n.close(); });
      })
    );
    return;
  }
  
  // ── REGULAR NOTIFICATION ──
  const title = data.title || 'Nexus';
  const options = {
    body: data.body || '',
    icon: data.icon || './icon-192.png',
    badge: data.badge || './icon-192.png',
    tag: data.notif_key || data.tag || ('nexus-' + Date.now()),
    data: {
      url: data.url || './#home',
      notif_key: data.notif_key || null,
      notifId: data.notifId || null,
      timestamp: Date.now()
    },
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ═══════════════════════════════════════════════════════════════
// CLICK — open portal + tell client to mark seen everywhere
// ═══════════════════════════════════════════════════════════════
self.addEventListener('notificationclick', function(event) {
  const notif = event.notification;
  notif.close();
  
  const notifKey = notif.tag || (notif.data && notif.data.notif_key);
  let targetUrl = (notif.data && notif.data.url) || './';
  
  if (event.action === 'clockin') {
    targetUrl = './#home';
  }
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const c = clientList[i];
        if (c.url.indexOf('oscarstaff.github.io') >= 0 ||
            c.url.indexOf('localhost') >= 0 ||
            c.url.indexOf('/Oscar') >= 0) {
          c.postMessage({ type: 'notif-click', notif_key: notifKey });
          c.focus();
          if (targetUrl !== c.url) {
            try { c.navigate(targetUrl); } catch(e) {}
          }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
