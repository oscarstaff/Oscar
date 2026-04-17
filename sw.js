console.log('[SW] Service worker loaded');

self.addEventListener('install', e => {
  console.log('[SW] Installing');
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  console.log('[SW] Activating');
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {});

self.addEventListener('push', e => {
  console.log('[SW] Push received:', e.data ? e.data.text() : 'no data');
  
  let title = 'Oscars';
  let options = { body: 'New notification', icon: '/Oscar/icon-192.png' };
  
  try {
    if (e.data) {
      const d = e.data.json();
      title = d.title || 'Oscars';
      options = {
        body: d.body || '',
        tag: d.tag || 'oscars',
        icon: '/Oscar/icon-192.png',
        vibrate: [100, 50, 100],
        data: { url: d.url || '/Oscar/' }
      };
    }
  } catch(err) {
    console.log('[SW] Parse error:', err);
    options.body = e.data ? e.data.text() : '';
  }

  e.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[SW] Notification shown'))
      .catch(err => console.error('[SW] showNotification failed:', err))
  );
});

self.addEventListener('notificationclick', e => {
  console.log('[SW] Notification clicked');
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url)
    ? 'https://oscarstaff.github.io' + e.notification.data.url
    : 'https://oscarstaff.github.io/Oscar/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('oscarstaff') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
