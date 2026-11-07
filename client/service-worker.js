import { PrecacheController } from 'workbox-precaching';
import { CACHE_NAME, filterPrecacheEntries, isAllowedStatic, safeCacheResponse } from './src/pwa/cache-policy.js';

const precache = new PrecacheController({ cacheName: CACHE_NAME, plugins: [{
  // The installation downloads only public assets and never carries session cookies.
  requestWillFetch: async ({ request }) => new Request(request, { credentials: 'omit' }),
  cacheWillUpdate: async ({ request, response }) => safeCacheResponse(response, request.url),
}] });
precache.precache(filterPrecacheEntries(self.__WB_MANIFEST));

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => /^jm-store-pwa-precache-v\d+$/.test(name) && name !== CACHE_NAME).map(name => caches.delete(name)))));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  // Unmatched requests fall through to the browser network; no runtime writes to cache.
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization') || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const response = await precache.matchPrecache('/offline.html');
      return response || new Response('Sin conexión. Vuelve a intentarlo cuando tengas conexión.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    }));
    return;
  }
  if (!url.search && isAllowedStatic(url.pathname)) event.respondWith(precache.matchPrecache(url.pathname).then(response => response || fetch(request)));
});
// Native waiting lifecycle: no forced activation, client claiming, reload, or background sync.
