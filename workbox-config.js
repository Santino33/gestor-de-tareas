// Exportaciones nombradas: Workbox CLI usa require(); Node >=22.12 carga este ESM.
// No exportar default: el CLI espera las opciones directamente en el objeto.
export const globDirectory = 'dist';
export const globPatterns = ['index.html', 'assets/**/*.{js,css}', 'icons/icon-{192,512,512-maskable}.png'];
export const swDest = 'dist/sw.js';
export const cacheId = 'gestor-tareas';
export const cleanupOutdatedCaches = true;
export const clientsClaim = true;
export const skipWaiting = false;
export const sourcemap = false;
export const inlineWorkboxRuntime = true;
export const importScripts = ['sw-cleanup.js'];
// /index.html es la reserva precargada; / usa la ruta de navegación runtime.
export const directoryIndex = null;
export const runtimeCaching = [
  {
    urlPattern: ({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'gestor-navigation', networkTimeoutSeconds: 3,
      expiration: { maxEntries: 5, maxAgeSeconds: 86400 },
      cacheableResponse: { statuses: [200] },
      precacheFallback: { fallbackURL: 'index.html' },
    },
  },
  {
    urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname === '/manifest.json',
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'gestor-manifest',
      expiration: { maxEntries: 1, maxAgeSeconds: 7 * 86400 },
      cacheableResponse: { statuses: [200] },
    },
  },
];
