export function createInstallPrompt(target) {
  let deferred = null;
  let state = { available: false };
  const listeners = new Set();
  const standalone = () => target.matchMedia?.('(display-mode: standalone)').matches || target.navigator?.standalone === true;
  const publish = available => { state = { available }; listeners.forEach(fn => fn()); };
  const before = event => {
    if (standalone()) return;
    event.preventDefault(); deferred = event; publish(true);
  };
  const installed = () => { deferred = null; publish(false); };
  target.addEventListener('beforeinstallprompt', before);
  target.addEventListener('appinstalled', installed);
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getSnapshot: () => state,
    async install() {
      const event = deferred; deferred = null; publish(false);
      if (!event || standalone()) return;
      try { await event.prompt(); await event.userChoice; } catch { /* Browser UI remains available. */ }
    },
    dispose() { target.removeEventListener('beforeinstallprompt', before); target.removeEventListener('appinstalled', installed); listeners.clear(); },
  };
}
export const installPrompt = typeof window === 'undefined' ? null : createInstallPrompt(window);
