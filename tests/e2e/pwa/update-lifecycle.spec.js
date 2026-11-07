import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

test('PWA: real generated SW waits for both windows; activation cleans only owned cache', async ({ browser }) => {
  const dist = new URL('../../../client/dist/', import.meta.url);
  const original = await readFile(new URL('service-worker.js', dist), 'utf8');
  const revised = original.replace(/"revision":"[^"]+","url":"offline.html"/, '"revision":"synthetic-build-B","url":"offline.html"');
  expect(revised).not.toBe(original);
  let version = 'A', writes = 0, assetCookies = 0;
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method !== 'GET') writes++;
    res.setHeader('Cache-Control', 'no-store');
    if (path.startsWith('/api')) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
    if (path === '/service-worker.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(version === 'A' ? original : revised); return; }
    if (path === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<title>Lifecycle fixture</title><label>Draft<textarea></textarea></label>'); return; }
    if (req.headers.cookie) assetCookies++;
    try {
      const bytes = await readFile(new URL('.' + path, dist));
      // The real app uses revalidatable public assets, not no-store, for this allowlist.
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.png') ? 'image/png' : 'text/html');
      res.end(path === '/offline.html' && version === 'B' ? bytes.toString().replace('</main>', '</main><!-- synthetic-build-B -->') : bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext();
  await context.addCookies([{ name: 'synthetic-session', value: 'not-a-real-session', url: origin }]);
  try {
    const first = await context.newPage(); await first.goto(origin);
    await first.evaluate(async () => { await navigator.serviceWorker.register('/service-worker.js'); await navigator.serviceWorker.ready; });
    await first.reload(); const second = await context.newPage(); await second.goto(origin);
    await first.getByLabel('Draft').fill('Unsubmitted draft A'); await second.getByLabel('Draft').fill('Unsubmitted draft B');
    await first.evaluate(async () => { const c = await caches.open('other-project-synthetic'); await c.put('/unrelated', new Response('keep')); });
    version = 'B'; await first.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await expect.poll(() => first.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);
    await expect(first.getByLabel('Draft')).toHaveValue('Unsubmitted draft A'); await expect(second.getByLabel('Draft')).toHaveValue('Unsubmitted draft B');
    await first.close(); expect(await second.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);
    await second.close();
    const next = await context.newPage(); await next.goto(origin);
    await expect.poll(() => next.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r.active?.state === 'activated' && !r.waiting; })).toBe(true);
    await context.setOffline(true); await next.goto(origin + '/offline-check');
    await expect(next.getByRole('heading', { name: 'Sin conexión' })).toBeVisible();
    expect(await next.content()).toContain('synthetic-build-B');
    expect(await next.evaluate(() => caches.has('other-project-synthetic'))).toBe(true); expect(writes).toBe(0); expect(assetCookies).toBe(0);
    const keys = await next.evaluate(async () => (await (await caches.open('jm-store-pwa-precache-v1')).keys()).map(r => r.url));
    expect(keys.filter(url => url.includes('offline.html'))).toHaveLength(1);
  } finally { await context.close(); await new Promise(resolve => server.close(resolve)); }
});
