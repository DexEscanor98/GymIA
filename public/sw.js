// Online-first: never cache API responses, credentials, or gym/customer records.
const CACHE = 'gymia-shell-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/offline.html', '/icon-192.png'])));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate')
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});
self.addEventListener('push', (event) => {
  let payload = { title: 'Gymia', body: 'Tienes un aviso nuevo.', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url || '/' },
      tag: payload.tag || 'gymia-notice',
      renotify: false,
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || '/', self.location.origin);
  if (destination.origin !== self.location.origin) destination.pathname = '/';
  const url = destination.href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === url);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
