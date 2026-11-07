import { useSyncExternalStore, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { installPrompt } from './install-prompt.js';
export function InstallAppButton() {
  const { available } = useSyncExternalStore(installPrompt.subscribe, installPrompt.getSnapshot);
  return available ? <button className="icon-button pwa-install-button" aria-label="Instalar JM-STORE" title="Instalar JM-STORE" onClick={() => installPrompt.install()}><Download size={21} /></button> : null;
}
export function ConnectionNotice() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener('online', change); window.addEventListener('offline', change);
    return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); };
  }, []);
  return !online ? <div className="connection-notice" role="status">Sin conexión. Vuelve a conectarte para consultar y guardar tus cambios.</div> : null;
}
