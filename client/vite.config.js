import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { filterPrecacheEntries } from './src/pwa/cache-policy.js';
export default defineConfig({
  plugins: [react(), VitePWA({
    strategies: 'injectManifest', srcDir: '.', filename: 'service-worker.js',
    manifest: false, injectRegister: false, includeManifestIcons: false,
    injectManifest: {
      globPatterns: ['assets/*.{js,css}', 'icons/jm-store-{192,512,maskable-512}.png', 'offline.html'],
      manifestTransforms: [async manifest => ({ manifest: filterPrecacheEntries(manifest), warnings: [] })],
    },
    devOptions: { enabled: false },
  })],
  server: {port:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:3001'}}, build:{outDir:'dist'},
});
