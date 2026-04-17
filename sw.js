// Force immediate activation
self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    self.clients.claim().then(() => {
      console.log('[SW] Activated and claimed clients');
    })
  );
});

// Keep SW alive with a fetch handler
self.addEventListener('fetch', e => {
  // Don't intercept — just keep SW active
});

self.addEventListener('push', e => {
  let data = { title: 'Oscars', body: 'New notification' };
  try { if(e.data) data = e.data.json(); } catch(_) {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'Oscars', {
      body: data.body || '',
      icon: '/Oscar/icon-192.png',
      badge: '/Oscar/icon-192.png',
      tag: data.tag || 'oscars',
      renotify: true,
      vibrate: [100, 50, 100],
      data: { url: data.url || '/Oscar/' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/Oscar/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('oscarstaff') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('https://oscarstaff.github.io' + url);
    })
  );
});
