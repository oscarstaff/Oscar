// Nexus Service Worker — handles push notifications + offline cache
const CACHE_NAME = 'nexus-v1';
const CORE_ASSETS = [
  './',
  './index.html'
];

// Install: cache core assets
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CORE_ASSETS).catch(function() {});
    })
  );
});

// Activate: clean old caches
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
  // Don't intercept supabase / external API calls
  if (req.url.indexOf('supabase.co') >= 0 || req.url.indexOf('googleapis.com') >= 0) return;
  if (req.url.indexOf('script.google.com') >= 0) return;
  
  event.respondWith(
    fetch(req).then(function(resp) {
      // Cache successful HTML responses
      if (resp.ok && req.url.endsWith('.html') || req.url.endsWith('/')) {
        const respClone = resp.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(req, respClone); });
      }
      return resp;
    }).catch(function() {
      return caches.match(req);
    })
  );
});

// PUSH HANDLER — fires when supabase Edge Function sends a push
self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Nexus', body: event.data ? event.data.text() : 'New notification' };
  }
  
  const title = data.title || 'Nexus';
  const options = {
    body: data.body || '',
    icon: data.icon || './icon-192.png',
    badge: data.badge || './icon-192.png',
    data: { url: data.url || './#home', notifId: data.notifId || null },
    tag: data.tag || 'nexus-' + Date.now(),
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// CLICK HANDLER — open the portal when notification is tapped
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If portal is already open, focus it
      for (let i = 0; i < clientList.length; i++) {
        const c = clientList[i];
        if (c.url.indexOf('oscarstaff.github.io') >= 0 || c.url.indexOf('localhost') >= 0) {
          c.focus();
          if (targetUrl !== c.url) c.navigate(targetUrl).catch(function(){});
          return;
        }
      }
      // Otherwise open new window
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
