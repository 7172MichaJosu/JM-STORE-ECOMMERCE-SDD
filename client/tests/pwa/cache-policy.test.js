import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedStatic, filterPrecacheEntries, safeCacheResponse } from '../../src/pwa/cache-policy.js';
test('only explicit public files and fingerprinted bundles are allowed', () => {
  for (const path of ['/offline.html', '/icons/jm-store-192.png', '/icons/jm-store-512.png', '/icons/jm-store-maskable-512.png', '/assets/index-Abc123_X.js', '/assets/index-Abc123_X.css']) assert.equal(isAllowedStatic(path), true, path);
  for (const path of ['/index.html', '/', '/assets/plain.js', '/assets/product-Abc123_X.png', '/api/products', '/api/auth/session', '/images/demo/laptop.jpg', '/icons/unknown.png', '/offline.html?email=test', '/assets/index-Abc123_X.js?x=1', 'https://example.test/offline.html', '//example.test/offline.html', '/admin/mi-cuenta/seguridad/confirmar-correo?oobCode=synthetic']) assert.equal(isAllowedStatic(path), false, path);
});
test('no-store, private, redirects and failures are never admitted to precache', () => {
  for (const cc of ['no-store', 'private, max-age=3600', 'public, no-store']) assert.equal(safeCacheResponse(new Response('private', { headers: { 'Cache-Control': cc } })), null);
  assert.equal(safeCacheResponse(new Response('error', { status: 500 })), null);
  assert.equal(safeCacheResponse(Response.redirect('https://example.test')), null);
  const publicAsset = new Response('public'); assert.equal(safeCacheResponse(publicAsset), publicAsset);
});
test('only the same-origin public offline canonicalization is accepted as a redirect', () => {
  const response = (url, cc = 'public') => Object.defineProperties(new Response('offline', { headers: { 'content-type': 'text/html', 'cache-control': cc } }), { redirected: { value: true }, url: { value: url } });
  const publicOffline = response('https://store.example/offline');
  assert.equal(safeCacheResponse(publicOffline, 'https://store.example/offline.html'), publicOffline);
  for (const target of ['https://other.example/offline', 'https://store.example/admin', 'https://store.example/offline?email=private']) assert.equal(safeCacheResponse(response(target), 'https://store.example/offline.html'), null);
  assert.equal(safeCacheResponse(publicOffline, 'https://store.example/api/auth/session'), null);
  assert.equal(safeCacheResponse(response('https://store.example/offline', 'no-store'), 'https://store.example/offline.html'), null);
});
test('precache filtering does not widen the approved list or retain query URLs', () => {
  const entries = [{ url: 'offline.html', revision: 'a' }, { url: 'assets/index-Abc123_X.js', revision: null }, { url: 'index.html', revision: 'b' }, { url: 'api/cart', revision: 'c' }];
  assert.deepEqual(filterPrecacheEntries(entries), entries.slice(0, 2));
});
