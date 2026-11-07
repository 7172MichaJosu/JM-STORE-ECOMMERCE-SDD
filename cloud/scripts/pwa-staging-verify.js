// Staging-only PWA probe. Uses a fresh guest cart and an existing synthetic ADMIN;
// never creates orders, changes stock, credentials, roles or existing user records.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { checkTarget } from './targets.js';
const target = await checkTarget(['--target', 'staging']);
if (target.worker !== 'jm-store-ecommerce-sdd-staging' || target.origin !== 'https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev') throw Error('Unapproved staging origin');
const session = JSON.parse(await readFile(new URL('../private/staging-current-session.json', import.meta.url), 'utf8'));
if (session.resourceGate?.blocked) throw Error('Staging resource gate is blocked');
const results = []; let label = 'resources', browser;
const check = (name, condition) => { label = name; results.push({ name, passed: Boolean(condition) }); if (!condition) throw Error('Verification failed'); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function inspectCache(page, needles = []) {
  return page.evaluate(async needles => {
    const entries = []; let sensitive = false;
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) {
      const url = new URL(request.url);
      entries.push({ name, path: url.pathname });
      if (needles.length) { const body = await (await (await caches.open(name)).match(request)).text(); if (needles.some(needle => body.includes(needle))) sensitive = true; }
    }
    return { entries, sensitive };
  }, needles);
}
try {
  const files = ['/manifest.webmanifest', '/service-worker.js', '/offline.html', '/icons/jm-store-192.png', '/icons/jm-store-512.png', '/icons/jm-store-maskable-512.png'];
  for (const file of files) {
    label = 'resource ' + file;
    const response = await fetch(target.origin + file);
    const bytes = Buffer.from(await response.arrayBuffer());
    const local = await readFile(new URL('../../client/dist' + file, import.meta.url));
    check(label + ' status/hash', response.status === 200 && digest(bytes) === digest(local));
    if (file === '/service-worker.js') check('SW MIME and revalidation', /javascript/.test(response.headers.get('content-type')) && !/immutable/.test(response.headers.get('cache-control') || ''));
  }
  browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: target.origin, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  label = 'browser service worker'; await page.goto('/catalogo');
  await expect(page.locator('.product-card').first()).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state), { timeout: 20000 }).toBe('activated');
  await page.reload();
  check('SW controls same-origin page', await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL === location.origin + '/service-worker.js'));
  const cdp = await context.newCDPSession(page); const manifest = await cdp.send('Page.getAppManifest');
  check('Browser manifest diagnostic', manifest.url.endsWith('/manifest.webmanifest') && !manifest.errors?.length);
  for (const width of [360, 1280]) { await page.setViewportSize({ width, height: 900 }); check('Published layout ' + width, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  const before = await inspectCache(page);
  const allowed = entry => /^jm-store-pwa-/.test(entry.name) && /^\/(offline\.html|icons\/jm-store-(192|512|maskable-512)\.png|assets\/[\w.-]+\.(js|css))$/.test(entry.path);
  check('Exactly six public precache resources', before.entries.length === 6 && before.entries.every(allowed));
  label = 'guest cart';
  const products = await (await page.request.get('/api/products')).json();
  const product = products.data.find(p => p.is_available && p.available_quantity >= 2);
  check('Available catalogue connected to API', Boolean(product));
  await page.goto('/productos/' + product.slug);
  await page.getByRole('button', { name: 'Agregar al carrito', exact: true }).click();
  await expect(page.locator('.cart-button span')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Abrir carrito' })).toHaveAttribute('data-cart-pending', 'false');
  await page.goto('/carrito'); await expect(page.locator('.cart-line')).toHaveCount(1);
  await page.getByRole('button', { name: 'Aumentar cantidad de ' + product.name, exact: true }).click();
  await expect(page.locator('.quantity span').first()).toHaveText('2');
  await page.getByRole('button', { name: 'Reducir cantidad de ' + product.name, exact: true }).click();
  await expect(page.locator('.quantity span').first()).toHaveText('1');
  await page.getByRole('button', { name: 'Quitar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir carrito' })).toHaveAttribute('data-cart-pending', 'false');
  const cart = await page.request.get('/api/cart'); const cartJson = await cart.json();
  check('Guest cart persisted empty in D1', cart.status() === 200 && cartJson.data.items.length === 0);
  check('API continues no-store', cart.headers()['cache-control'] === 'no-store');
  if (process.argv.includes('--admin')) {
    label = 'synthetic ADMIN login';
    const admin = JSON.parse(await readFile(new URL('../private/staging-synthetic-admin.json', import.meta.url), 'utf8'));
    if (!admin.synthetic || !/^jm-sdd-stage-[\da-f-]+@example\.test$/.test(admin.email)) throw Error('Synthetic ADMIN required');
    await page.goto('/admin/ingresar');
    await page.getByLabel('Correo electrónico').fill(admin.email); await page.getByLabel('Contraseña', { exact: true }).fill(admin.password);
    await page.getByRole('button', { name: 'Ingresar al panel' }).click(); await expect(page).toHaveURL(/\/admin$/);
    const auth = await (await page.request.get('/api/auth/session')).json(); check('Firebase login retains ADMIN role', auth.data.user?.role === 'ADMIN');
    check('Admin summary readable', (await page.request.get('/api/admin/summary')).status() === 200);
    await page.goto('/admin/mi-cuenta/seguridad'); await expect(page.getByRole('heading', { name: 'Seguridad de mi cuenta' })).toBeVisible();
    check('Security UI readable without credential changes', true);
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(); await expect(page).toHaveURL(/\/admin\/ingresar$/);
    const audit = await inspectCache(page, [admin.email, admin.password, auth.data.csrfToken]);
    check('No synthetic credentials/private API cached', !audit.sensitive && audit.entries.every(allowed));
  }
  label = 'offline navigation'; await context.setOffline(true); await page.goto('/catalogo');
  await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible(); check('Published offline notice', true);
  check('Offline API receives no cached response', await page.evaluate(async () => { try { await fetch('/api/products'); return false; } catch { return true; } }));
  await context.setOffline(false); await page.getByRole('link', { name: 'Volver a intentar' }).click(); await expect(page.getByRole('link', { name: 'JM-STORE inicio' })).toBeVisible();
  check('Online recovery', true);
  await context.close();
} catch (error) { results.push({ name: label, passed: false, errorType: error.name }); process.exitCode = 1; }
finally { if (browser) await browser.close(); }
const report = { checkedAt: new Date().toISOString(), origin: target.origin, results, passed: results.every(row => row.passed), actualPhysicalInstallationTested: false, orderOrStockMutations: false, credentialsPrinted: false };
await writeFile(new URL('../private/pwa-staging-validation.json', import.meta.url), JSON.stringify(report,null,2), { mode: 0o600 });
console.log(JSON.stringify(report,null,2));
