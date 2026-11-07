import { test, expect } from '@playwright/test';
import { controlPage, cacheEntries, assertPublicCache } from './fixtures.js';
test('PWA: offline navigation gives only the static notice; API and mutations never fall back', async ({ page, context }) => {
  await controlPage(page);
  await page.goto('/catalogo'); await expect(page.locator('.product-card').first()).toBeVisible();
  assertPublicCache(await cacheEntries(page));
  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible();
  await page.goto('/cuenta/pedidos');
  await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible();
  await expect(page.locator('.product-card, form')).toHaveCount(0);
  const outcome = await page.evaluate(async () => {
    const results = [];
    for (const options of [{}, { method: 'POST', body: '{}' }]) {
      try { await fetch('/api/cart', options); results.push('unexpected response'); } catch { results.push('network failure'); }
    }
    return results;
  });
  expect(outcome).toEqual(['network failure', 'network failure']); assertPublicCache(await cacheEntries(page));
  await context.setOffline(false); await page.getByRole('link', { name: 'Volver a intentar' }).click();
  await expect(page.getByRole('link', { name: 'JM-STORE inicio' })).toBeVisible();
});
test('PWA: queries, catalogue images and unknown resources are not cached at runtime', async ({ page }) => {
  await controlPage(page);
  const before = await cacheEntries(page);
  await page.evaluate(async () => {
    for (const url of ['/api/auth/session', '/api/products', '/images/demo/laptop.jpg', '/offline.html?oobCode=synthetic-only']) await fetch(url);
  });
  expect(await cacheEntries(page)).toEqual(before);
});
