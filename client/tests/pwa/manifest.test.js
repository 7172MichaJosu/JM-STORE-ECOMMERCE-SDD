import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
test('manifest keeps JM identity, standalone scope and valid PNG icons', async () => {
  const manifest = JSON.parse(await readFile(new URL('public/manifest.webmanifest', root), 'utf8'));
  for (const key of ['name', 'short_name']) assert.equal(manifest[key], 'JM-STORE');
  assert.equal(manifest.display, 'standalone');
  for (const key of ['id', 'start_url', 'scope']) assert.equal(manifest[key], '/');
  assert.equal(manifest.theme_color, '#ffe600');
  for (const size of [192, 512]) assert.ok(manifest.icons.some(i => i.sizes === `${size}x${size}` && i.purpose === 'any'));
  assert.ok(manifest.icons.some(i => i.purpose === 'maskable' && i.sizes === '512x512'));
  for (const icon of manifest.icons) {
    assert.equal(icon.type, 'image/png'); assert.match(icon.src, /^\/icons\/jm-store-[a-z0-9-]+\.png$/);
    const png = await readFile(new URL('public' + icon.src, root));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /rel="manifest"[^>]*href="\/manifest.webmanifest"/);
  for (const key of ['related_applications', 'protocol_handlers', 'share_target']) assert.equal(manifest[key], undefined);
});
