/* ============================================================
   BuildBoss FREE — Service Worker v4
   ============================================================ */

const CACHE_NAME    = 'buildbossfree-v1';
const RUNTIME_CACHE = 'buildbossfree-runtime-v1';
const OFFLINE_URL   = 'offline.html';

const PRECACHE_URLS = [
  './',
  'index.html',
  'offline.html',
  'manifest.json',
  'sw.js',
  'icon-192x192.png',
  '404.html',
  'about.html',
  'help.html',
  'contact.html',
  'update.html',
  'privacy-policy.html',
  'terms-and-conditions.html',
  'legal-disclaimer.html'
];

const CACHEABLE_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdnjs.cloudflare.com',
  'https://cdn.jsdelivr.net'
];

/* ── Install: precache all shell files ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: delete old caches ── */
self.addEventListener('activate', event => {
  const keep = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  if (CACHEABLE_ORIGINS.some(o => request.url.startsWith(o))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirstWithCacheFallback(request));
    return;
  }
});

async function networkFirstWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return await caches.match(OFFLINE_URL) ||
             await caches.match('./');
    }
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache  = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(r => {
    if (r && r.status === 200) cache.put(request, r.clone());
    return r;
  }).catch(() => null);
  return cached || fetchPromise;
}

self.addEventListener('sync', event => {
  if (event.tag === 'buildbosspro-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE', timestamp: Date.now() }))
      )
    );
  }
});

self.addEventListener('periodicsync', event => {
  if (event.tag === 'buildbosspro-periodic-sync') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE_URLS)).catch(() => {})
    );
  }
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || 'BuildBoss FREE', {
    body: data.body || 'You have a new notification.',
    icon: 'icon-192x192.png',
    badge: 'icon-192x192.png',
    data: { url: data.url || './' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const c of clients) {
        if (c.url === targetUrl && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
