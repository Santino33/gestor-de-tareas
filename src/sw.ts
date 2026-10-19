const CACHE_NAME = 'gestor-tareas-v2';
const CORE_ASSETS = ['/', '/index.html', '/manifest.json'];

const swScope = self as unknown as ServiceWorkerGlobalScope;

swScope.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

swScope.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then(async (names) => {
      await Promise.all(names.filter((name) => name.startsWith('gestor-tareas-v') && name !== CACHE_NAME)
        .map((name) => caches.delete(name)));
      await swScope.clients.claim();
    })
  );
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
