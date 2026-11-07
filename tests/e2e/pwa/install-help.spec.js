import { test, expect } from '@playwright/test';
test('PWA: manifest, icon responses and deep links are discoverable', async ({ page, request }) => {
  await page.goto('/catalogo');
  await expect(page.locator('link[rel=manifest]')).toHaveAttribute('href', '/manifest.webmanifest');
  const response = await request.get('/manifest.webmanifest');
  expect(response.status()).toBe(200); expect(response.headers()['content-type']).toMatch(/json|manifest/);
  const manifest = await response.json(); expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) { const r = await request.get(icon.src); expect(r.status()).toBe(200); expect(r.headers()['content-type']).toContain('image/png'); }
  await expect(page.getByRole('button', { name: 'Instalar JM-STORE', exact: true })).toHaveCount(0);
  await expect(page.locator('.product-card').first()).toBeVisible();
});
test('PWA: install is user initiated, dismissal/installed state keeps the web usable', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.__prompts = 0;
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => { window.__prompts++; };
    e.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(e);
  });
  const button = page.getByRole('button', { name: 'Instalar JM-STORE', exact: true });
  await expect(button).toBeVisible(); expect(await page.evaluate(() => window.__prompts)).toBe(0);
  await button.click(); await expect(button).toHaveCount(0); expect(await page.evaluate(() => window.__prompts)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.getByRole('link', { name: 'JM-STORE inicio' })).toBeVisible();
});
