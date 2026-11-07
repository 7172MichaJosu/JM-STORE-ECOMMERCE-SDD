export function registerPwa(target = window) {
  if (!target.isSecureContext || !('serviceWorker' in target.navigator)) return;
  const register = () => target.navigator.serviceWorker.register('/service-worker.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
    console.warn('JM-STORE: la instalación sin conexión no está disponible en este navegador.');
  });
  if (target.document.readyState === 'complete') void register();
  else target.addEventListener('load', register, { once: true });
}
