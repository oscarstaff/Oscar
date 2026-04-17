const CACHE_NAME = 'oscars-v1';

self.addEventListener('install', function(e){
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(clients.claim());
});

self.addEventListener('push', function(e){
  if(!e.data) return;
  let data;
  try { data = e.data.json(); } catch(err) { data = {title:'Oscars',body:e.data.text()}; }

  const title = data.title || 'Oscars Staff Portal';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-badge.png',
    tag: data.tag || 'oscars-notif',
    renotify: true,
    data: { url: data.url || '/' },
    actions: data.actions || [],
    vibrate: [100, 50, 100],
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(function(clientList){
      for(let c of clientList){
        if(c.url.includes('oscarstaff') && 'focus' in c) return c.focus();
      }
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});
