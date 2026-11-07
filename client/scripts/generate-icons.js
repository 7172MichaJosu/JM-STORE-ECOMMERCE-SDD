// Reproducible raster exports of the existing JM vector; no external image service.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const svg = await readFile(new URL('../public/icons/jm-store-master.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
try {
  for (const [name, size] of [['192', 192], ['512', 512], ['maskable-512', 512]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await page.screenshot({ path: fileURLToPath(new URL(`../public/icons/jm-store-${name}.png`, import.meta.url)) });
    await page.close();
  }
} finally { await browser.close(); }
