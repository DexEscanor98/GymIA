// Online-first: never cache API responses, credentials, or gym/customer records.
const CACHE = 'gymia-shell-v2';
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

async function syncOfflineProductSales() {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('gymia-offline-v1', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('snapshots'))
        db.createObjectStore('snapshots', { keyPath: 'tenantId' });
      if (!db.objectStoreNames.contains('sales'))
        db.createObjectStore('sales', { keyPath: 'idempotencyKey' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const sales = await new Promise((resolve, reject) => {
    const tx = database.transaction('sales', 'readonly');
    const request = tx.objectStore('sales').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  for (const sale of sales.filter((record) => record.status === 'pending')) {
    const response = await fetch('/api/operations', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': sale.tenantId },
      body: JSON.stringify({ action: 'sale.create', input: sale.input }),
    });
    await new Promise((resolve, reject) => {
      const tx = database.transaction('sales', 'readwrite');
      if (response.ok) tx.objectStore('sales').delete(sale.idempotencyKey);
      else if (response.status < 500) {
        sale.status = 'failed';
        tx.objectStore('sales').put(sale);
      } else {
        reject(new Error('The server could not confirm the offline sale.'));
        return;
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    if (response.status >= 500) throw new Error('The server could not confirm the offline sale.');
  }
  database.close();
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'gymia-sync-sales') event.waitUntil(syncOfflineProductSales());
});
