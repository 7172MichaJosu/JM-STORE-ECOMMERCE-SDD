const publicFiles = new Set(['/offline.html', '/icons/jm-store-192.png', '/icons/jm-store-512.png', '/icons/jm-store-maskable-512.png']);
export const CACHE_NAME = 'jm-store-pwa-precache-v1';
export function isAllowedStatic(path) {
  return typeof path === 'string' && (publicFiles.has(path) || /^\/assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(path));
}
export function filterPrecacheEntries(entries) {
  return entries.filter(entry => isAllowedStatic('/' + entry.url.replace(/^\//, '')));
}
export function safeCacheResponse(response, requestUrl) {
  if (!response || response.status !== 200 || /(?:no-store|private)/i.test(response.headers.get('cache-control') || '')) return null;
  if (response.redirected) {
    try {
      const source = new URL(requestUrl), target = new URL(response.url);
      if (source.origin !== target.origin || source.pathname !== '/offline.html' || source.search || target.pathname !== '/offline' || target.search || !response.headers.get('content-type')?.startsWith('text/html')) return null;
    } catch { return null; }
  }
  return response;
}
