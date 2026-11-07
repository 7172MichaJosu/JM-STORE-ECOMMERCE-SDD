import { test, expect } from '@playwright/test';
import { controlPage } from './fixtures.js';
test('PWA: cart p95 visual feedback stays within 100 ms with 1500 ms API delay', async ({ page }, testInfo) => {
  await controlPage(page);
  const catalog = await (await page.request.get('/api/products')).json();
  const product = catalog.data.find(p => p.is_available && p.available_quantity >= 10);
  expect(Boolean(product)).toBe(true);
  await page.goto('/productos/' + product.slug);
  await expect(page.getByRole('button', { name: 'Agregar al carrito', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir carrito' })).toHaveAttribute('data-cart-pending', 'false');
  let delayed = 0;
  await page.route('**/api/cart/items/*', async route => { delayed++; await new Promise(resolve => setTimeout(resolve, 1500)); await route.continue(); });
  const samples = [];
  async function click(button, expected) {
    await page.evaluate(expected => {
      window.__pwaFeedback = null;
      document.addEventListener('click', () => {
        const start = performance.now();
        const measure = () => {
          if (Number(document.querySelector('.cart-button span')?.textContent || 0) === expected) window.__pwaFeedback = performance.now() - start;
          else if (performance.now() - start < 5000) requestAnimationFrame(measure);
        };
        requestAnimationFrame(measure);
      }, { once: true, capture: true });
    }, expected);
    await button.click(); await expect.poll(() => page.evaluate(() => window.__pwaFeedback)).not.toBeNull();
    samples.push(await page.evaluate(() => window.__pwaFeedback));
  }
  for (let i = 1; i <= 10; i++) await click(page.getByRole('button', { name: 'Agregar al carrito', exact: true }), i);
  await page.getByRole('button', { name: 'Abrir carrito' }).click(); await page.getByRole('link', { name: 'Ver mi carrito', exact: true }).click();
  for (let i = 9; i >= 1; i--) await click(page.getByRole('button', { name: 'Reducir cantidad de ' + product.name, exact: true }), i);
  await click(page.getByRole('button', { name: 'Quitar', exact: true }), 0);
  await expect(page.getByRole('button', { name: 'Abrir carrito' })).toHaveAttribute('data-cart-pending', 'false', { timeout: 20000 });
  expect(delayed).toBeGreaterThan(0);
  const sorted = [...samples].sort((a,b) => a-b), p95 = sorted[Math.ceil(sorted.length * .95) - 1];
  expect(p95).toBeLessThanOrEqual(100);
  const summary = { samples: samples.length, delayMs: 1500, p95Ms: Math.round(p95 * 100) / 100, maxMs: Math.round(sorted.at(-1) * 100) / 100 };
  console.log('PWA cart feedback: ' + JSON.stringify(summary));
  testInfo.annotations.push({ type: 'PWA cart feedback', description: JSON.stringify(summary) });
});
