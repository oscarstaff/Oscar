self.addEventListener('install', function(e){
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(e){
  e.waitUntil(clients.claim());
});

self.addEventListener('push', function(e){
  if(!e.data) return;
  let data;
  try { data = e.data.json(); } catch(err) { data = {title:'Oscars',body:e.data.text()}; }
  const options = {
    body: data.body || '',
    icon: data.icon || 'https://oscarstaff.github.io/Oscar/icon-192.png',
    tag: data.tag || 'oscars-notif',
    renotify: true,
    data: { url: data.url || 'https://oscarstaff.github.io/Oscar/' },
    vibrate: [100, 50, 100],
  };
  e.waitUntil(self.registration.showNotification(data.title || 'Oscars', options));
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || 'https://oscarstaff.github.io/Oscar/';
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(function(list){
      for(let c of list){
        if(c.url.includes('oscarstaff') && 'focus' in c) return c.focus();
      }
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});
