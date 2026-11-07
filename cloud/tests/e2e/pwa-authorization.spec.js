import { test, expect } from '@playwright/test';
import { adminLogin, register } from '../../../tests/e2e/fixtures/helpers.js';
import { controlPage, cacheEntries, assertPublicCache } from '../../../tests/e2e/pwa/fixtures.js';
test.beforeEach(async ({ context, baseURL }) => {
  if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw Error('Local synthetic fixture only');
  await context.setExtraHTTPHeaders({ 'CF-Connecting-IP': '192.0.2.205' });
});
test('PWA: ADMIN permissions stay server-side, logout and account switch never cache identity', async ({ page }) => {
  await controlPage(page); await adminLogin(page);
  await expect(page).toHaveURL(/\/admin$/);
  const current = await (await page.request.get('/api/auth/session')).json(); expect(current.data.user.role).toBe('ADMIN');
  await page.goto('/admin/mi-cuenta/seguridad'); await expect(page.getByRole('heading', { name: 'Seguridad de mi cuenta' })).toBeVisible();
  const security = await page.request.get('/api/admin/me/security'); expect(security.status()).toBe(200); expect(security.headers()['cache-control']).toBe('no-store');
  assertPublicCache(await cacheEntries(page));
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(); await expect(page).toHaveURL(/\/admin\/ingresar$/);
  await register(page); expect((await page.request.get('/api/admin/me/security')).status()).toBe(403);
  await page.goto('/admin'); await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
  assertPublicCache(await cacheEntries(page));
  expect(await page.evaluate(async () => {
    const names = await caches.keys();
    return names.every(name => name.startsWith('jm-store-pwa-'));
  })).toBe(true);
});
