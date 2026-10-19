// Complemento JavaScript de ciclo de vida, sin enrutamiento ni manejador fetch.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(
    names.filter((name) => /^gestor-tareas-v\d+$/.test(name)).map((name) => caches.delete(name)),
  )));
});
