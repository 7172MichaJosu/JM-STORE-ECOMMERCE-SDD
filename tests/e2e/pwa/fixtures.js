import { expect } from '@playwright/test';
export async function controlPage(page) {
  await page.goto('/');
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state), { timeout: 15000 }).toBe('activated');
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}
export async function cacheEntries(page) {
  return page.evaluate(async () => {
    const result = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) result.push({ name, url: request.url });
    }
    return result;
  });
}
export function assertPublicCache(entries) {
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    expect(entry.name).toMatch(/^jm-store-pwa-/);
    const url = new URL(entry.url);
    expect(url.pathname).toMatch(/^\/(offline\.html|icons\/jm-store-(192|512|maskable-512)\.png|assets\/[\w.-]+\.(js|css))$/);
    expect(url.searchParams.has('oobCode')).toBe(false);
    expect(url.pathname).not.toMatch(/api|images|admin|cuenta/);
  }
}
