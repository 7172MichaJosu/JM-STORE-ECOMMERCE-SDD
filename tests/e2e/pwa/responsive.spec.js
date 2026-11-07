import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { controlPage } from './fixtures.js';
test('PWA: installation control and offline notice stay accessible at phone/tablet/desktop sizes', async ({ page, context }) => {
  await controlPage(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); });
  for (const [width, height] of [[360, 800], [768, 1024], [1024, 768], [1280, 900]]) {
    await page.setViewportSize({ width, height });
    const button = page.getByRole('button', { name: 'Instalar JM-STORE', exact: true });
    await expect(button).toBeVisible(); await button.focus(); await expect(button).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      const result = await new AxeBuilder({ page }).include('.header').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      expect(result.violations).toEqual([]);
    }
  }
  await context.setOffline(true); await page.goto('/offline-check');
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
