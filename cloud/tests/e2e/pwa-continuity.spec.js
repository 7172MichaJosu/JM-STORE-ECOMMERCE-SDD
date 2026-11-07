import { test, expect } from '@playwright/test';
import { register, address } from '../../../tests/e2e/fixtures/helpers.js';
import { controlPage, cacheEntries, assertPublicCache } from '../../../tests/e2e/pwa/fixtures.js';

test.beforeEach(async ({ context, baseURL }) => {
  if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw Error('Local synthetic fixture only');
  // Keep this synthetic client out of other tests' 300/minute IP bucket.
  await context.setExtraHTTPHeaders({ 'CF-Connecting-IP': '192.0.2.204' });
});

test('PWA/D1: controlled client keeps one order, authoritative cart and history after reload', async ({ page, context, request }) => {
  await controlPage(page);
  const manifest = await request.get('/manifest.webmanifest'); expect(manifest.status()).toBe(200); expect(manifest.headers()['content-type']).toMatch(/manifest|json/);
  const script = await request.get('/service-worker.js'); expect(script.status()).toBe(200); expect(script.headers()['content-type']).toMatch(/javascript/);
  expect(script.headers()['content-security-policy']).toContain("default-src 'self'");
  const account = await register(page); await address(page);
  const session = await (await page.request.get('/api/auth/session')).json();
  expect(session.data.user.role).toBe('CUSTOMER');
  const catalog = await (await page.request.get('/api/products')).json();
  const product = catalog.data.find(p => p.is_available && p.available_quantity >= 10);
  expect(Boolean(product)).toBe(true);
  await page.goto('/productos/' + product.slug); await page.getByRole('button', { name: 'Agregar al carrito', exact: true }).click();
  await expect(page.locator('.cart-button span')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Abrir carrito' })).toHaveAttribute('data-cart-pending', 'false');
  await page.reload(); await expect(page.locator('.cart-button span')).toHaveText('1');
  const anotherWindow = await context.newPage(); await anotherWindow.goto('/carrito');
  await expect(anotherWindow.locator('.cart-line')).toHaveCount(1); await anotherWindow.close();
  await page.goto('/carrito'); await expect(page.locator('.cart-line')).toHaveCount(1);
  const persistedCart = await page.request.get('/api/cart');
  const persistedPayload = await persistedCart.json();
  expect({ status: persistedCart.status(), code: persistedPayload.error?.code }).toEqual({ status: 200, code: undefined });
  expect(persistedPayload.data.issues).toEqual([]);
  await expect(page.locator('.cart-sync-error')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir carrito' })).toHaveAttribute('data-cart-pending', 'false');
  await page.getByRole('link', { name: 'Continuar compra' }).click();
  await page.getByRole('button', { name: 'Revisar mi pedido' }).click();
  await page.getByLabel('Aprobar pago simulado').check(); await page.getByRole('button', { name: 'Confirmar simulación' }).click();
  await expect(page.getByText('Pago simulado aprobado', { exact: true })).toBeVisible();
  const orderUrl = page.url(); await page.reload(); expect(page.url()).toBe(orderUrl);
  await expect(page.getByText('Pago simulado aprobado', { exact: true })).toBeVisible();
  const orders = await (await page.request.get('/api/orders')).json(); expect(orders.data).toHaveLength(1);
  const cartResponse = await page.request.get('/api/cart'); expect(cartResponse.headers()['cache-control']).toBe('no-store'); expect((await cartResponse.json()).data.items).toEqual([]);
  assertPublicCache(await cacheEntries(page));
  expect(await page.evaluate(async needles => {
    for (const name of await caches.keys()) for (const key of await (await caches.open(name)).keys()) {
      const text = await (await (await caches.open(name)).match(key)).text();
      if (needles.some(needle => text.includes(needle))) return true;
    }
    return false;
  }, [account.email, account.password, session.data.csrfToken])).toBe(false);
});
