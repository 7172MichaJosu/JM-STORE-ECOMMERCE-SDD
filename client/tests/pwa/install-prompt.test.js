import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstallPrompt } from '../../src/pwa/install-prompt.js';
import { registerPwa } from '../../src/pwa/register.js';
test('installation only prompts after a user action and consumes one deferred event', async () => {
  const target = new EventTarget(); const store = createInstallPrompt(target); let calls = 0;
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = async () => { calls++; }; e.userChoice = Promise.resolve({ outcome: 'dismissed' });
  target.dispatchEvent(e); assert.equal(e.defaultPrevented, true); assert.equal(calls, 0); assert.equal(store.getSnapshot().available, true);
  await store.install(); await store.install(); assert.equal(calls, 1); assert.equal(store.getSnapshot().available, false); store.dispose();
});
test('standalone never promotes another installation', () => {
  const target = new EventTarget(); target.matchMedia = () => ({ matches: true });
  const store = createInstallPrompt(target); target.dispatchEvent(new Event('beforeinstallprompt'));
  assert.equal(store.getSnapshot().available, false); store.dispose();
});
test('registration waits for load and preserves native activation policy', async () => {
  const target = new EventTarget(); let call;
  Object.assign(target, { isSecureContext: true, document: { readyState: 'loading' }, navigator: { serviceWorker: { register: async (...args) => { call = args; } } } });
  registerPwa(target); assert.equal(call, undefined); target.dispatchEvent(new Event('load'));
  assert.deepEqual(call, ['/service-worker.js', { scope: '/', updateViaCache: 'none' }]);
});
test('blocked storage or unsupported service workers degrade without breaking startup', async () => {
  let warnings = 0; const warn = console.warn;
  console.warn = () => warnings++;
  try {
    registerPwa({ isSecureContext: false });
    registerPwa({ isSecureContext: true, navigator: {} });
    registerPwa({ isSecureContext: true, document: { readyState: 'complete' }, navigator: { serviceWorker: { register: () => Promise.reject(new Error('synthetic storage denial')) } } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(warnings, 1);
  } finally { console.warn = warn; }
});
