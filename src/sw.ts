const CACHE_NAME = 'gestor-tareas-v1';
const CORE_ASSETS = ['/', '/index.html', '/manifest.json'];

const swScope = self as unknown as ServiceWorkerGlobalScope;

swScope.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

swScope.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(swScope.clients.claim());
});

swScope.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then((response) => response ?? Response.error())
        );
    })
  );
});