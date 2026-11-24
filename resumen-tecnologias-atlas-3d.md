# Atlas 3D — Resumen de tecnologías por sesión

Atlas 3D es una aplicación web progresiva (PWA) para estudiar MVC, arquitectura en capas y microservicios. El proyecto evolucionó desde una interfaz en TypeScript sin framework hasta tres variantes independientes que comparten el motor 3D, la lógica de datos y el Service Worker. La [versión publicada](https://atlas-3d-pwa.pages.dev/) es React S43.

## Evolución técnica

| Etapa | Tecnologías y técnicas | Qué aportaron |
| --- | --- | --- |
| Arranque | HTML, CSS, DOM, TypeScript, Vite, Node.js y npm | Interfaz web, estilos adaptables, módulos tipados, entorno de desarrollo y compilación de producción. El manifiesto introdujo la descripción de la PWA: nombre, iconos y forma de apertura. |
| S33 · Datos y notas | IndexedDB y Web Crypto | Persistencia de visitas, favoritos y notas en el navegador. Las notas guardadas se cifran con AES-GCM de 256 bits, usando una clave derivada de la contraseña mediante PBKDF2 y una sal. La contraseña no se guarda. |
| S34 · Base offline | Service Worker, Cache Storage y Web App Manifest | Registro de un worker que intercepta solicitudes y permite servir recursos sin conexión. El manifiesto ayuda a instalar la app, pero no es lo que la hace funcionar offline. |
| S35 · Visor y orientación | Three.js, WebGL, `OrbitControls` y `DeviceOrientationEvent` | Escena 3D interactiva que se puede girar con el puntero o, en dispositivos compatibles, inclinando el teléfono. Incluye calibración y solicitud de permiso cuando el navegador la exige. |
| S36 · Cámara | MediaDevices, `getUserMedia()` y vídeo HTML | Vista de la cámara como fondo del visor. Es distinta de WebXR: mostrar vídeo no detecta superficies ni ancla modelos. |
| S37 · Descargas y avisos | Workbox, `vite-plugin-pwa`, `InjectManifest`, IndexedDB, Background Sync y Notifications API | Service Worker propio con precaché y rutas de caché. Las fichas se descargan bajo demanda; la cola vive en IndexedDB y el contenido en Cache Storage. Si no hay Background Sync, la descarga puede ejecutarse desde la página. Los avisos son locales, no notificaciones push de un servidor. |
| S38 · Entrada y salida de AR | WebXR `immersive-ar`, diagnóstico de contexto seguro, detección de capacidades y ciclo de sesión | La app comprueba si el navegador ofrece AR inmersiva antes de solicitarla. Si no está disponible, el visor 3D normal sigue funcionando. |
| S39 · Colocación y gestos | WebXR Hit Test, Anchors, DOM Overlay, Pointer Events, IWER y SEM | Retícula para detectar superficies, toque para colocar y ancla si la sesión la concede. Un dedo mueve el modelo y dos permiten girarlo o escalarlo. Si falta alguna capacidad, se ofrece una colocación alternativa con su limitación explícita. IWER y SEM simulan el entorno para pruebas de escritorio. |
| S40 · Catálogo y migración | Datos tipados, fichas JSON, constructor común de Three.js, `Raycaster`, `CanvasTexture`, IndexedDB v3 y `localStorage` | El catálogo construye mallas, flechas y rótulos desde los datos. La selección en el lienzo y la lista muestran la misma pieza. La migración conserva progreso, favoritos y notas de modelos anteriores; `localStorage` conserva el rastro de diagnóstico de AR. |
| S41 · Instalación y conexión | `beforeinstallprompt`, `appinstalled`, modo `standalone`, eventos `online`/`offline`, Fetch y `AbortController` | Interfaz para ofertar, aplazar o explicar la instalación; alternativa manual en iOS. La app distingue entre lo que informa `navigator.onLine` y una respuesta efectiva del servidor. |
| S42 · Dibujo y auditoría | `requestAnimationFrame`, WebGL, separación de paquetes, CSS `aspect-ratio`, Lighthouse, Playwright, Chromium y Chrome DevTools Protocol (CDP) | El visor normal dibuja cuando cambia la escena y se detiene en reposo; WebXR controla el ciclo en AR. Se reserva espacio para evitar saltos de diseño y se automatizan pruebas de instalabilidad, precaché, recarga offline y redibujado. |
| 42A · Carga diferida | `import()` dinámico, Vite y precaché de Workbox | Three.js y el visor no se ejecutan al mostrar la ficha inicial. El Service Worker guarda los módulos por adelantado para que el primer uso del visor pueda ocurrir sin conexión después del precaché. |
| S43 · React | React 19, TSX, Vite, componentes, hooks, `StrictMode` y registro del SW con `vite-plugin-pwa` | React controla el estado de la interfaz y los borradores por tarjeta. Las referencias y efectos conectan y limpian el visor. Conserva el motor, admite despliegue en subruta y no pierde un borrador al cambiar otro favorito. |
| S44 · Angular | Angular 22, Angular CLI, TypeScript 6, plantillas, señales, inyección de dependencias, `afterNextRender`, `DestroyRef`, esbuild y `workbox-build` | La variante funciona sin `zone.js`. Angular organiza la interfaz y su ciclo de vida; esbuild y Workbox empaquetan el mismo Service Worker, sin sustituirlo por `ngsw`. |
| S45 · Comparación | Checklist común, Playwright, CDP y Lighthouse | Comparación de las tres compilaciones con pruebas equivalentes y cinco corridas móviles intercaladas por variante. Se añadió un control negativo para comprobar que el checklist detecta la pérdida de borradores. |
| Publicación | Git, GitHub, Cloudflare Pages, HTTPS, MCP de Cloudflare y Wrangler | Git conserva el historial y GitHub el código. Cloudflare Pages sirve el build estático de React mediante Direct Upload: el MCP creó y verificó el proyecto, y Wrangler subió los archivos. No se desplegó un backend ni el simulador. El flujo manual de GitHub Pages para Angular quedó preparado como alternativa. |

## Cómo encajan las tecnologías

- **Interfaz:** Vanilla usa TypeScript y DOM; React usa componentes y hooks; Angular usa plantillas, servicios y señales. Cada variante tiene su propio build.
- **Motor compartido:** los módulos de [`src/`](https://github.com/Santino33/PWA-Project-3D/tree/main/src) contienen el catálogo, Three.js, WebXR, la persistencia y el Service Worker. React y Angular acceden a ellos mediante [`compartido/motor/`](https://github.com/Santino33/PWA-Project-3D/tree/main/compartido/motor), sin duplicarlos.
- **Datos sin conexión:** IndexedDB guarda el estado por modelo; Cache Storage conserva archivos; Workbox coordina el precaché y las solicitudes. Los datos están aislados por origen: los del entorno local no se trasladan automáticamente al dominio publicado.
- **Pruebas y límites:** Playwright y Chromium comprueban comportamiento; Lighthouse mide rendimiento, accesibilidad, buenas prácticas y SEO. IWER y SEM validan el flujo de AR simulada, no la disponibilidad de AR nativa ni la instalación en un teléfono físico.

## Resultado de la comparación

| Variante | Checklist final | Mediana de Lighthouse móvil |
| --- | ---: | ---: |
| Vanilla 42A | 12/13 | 100 |
| React S43 | 13/13 | 91 |
| Angular S44 | 13/13 | 82 |

Vanilla fue la más rápida en la tanda local, pero perdió el borrador al cambiar otro favorito. **React fue la versión publicada** porque conservó ese borrador y obtuvo mejor rendimiento que Angular en la misma tanda. Las cifras describen estas compilaciones y no son una comparación general entre frameworks.

**Referencias del proyecto:** [checkpoint S37](https://github.com/Santino33/PWA-Project-3D/blob/main/LEEME.txt) · [plan de las sesiones 39–45](https://github.com/Santino33/PWA-Project-3D/blob/main/docs/spec-plan-sesiones-39-45.md) · [evidencia y decisión final](https://github.com/Santino33/PWA-Project-3D/blob/main/docs/sesion45-cierre.md) · [guía de exposición](https://github.com/Santino33/PWA-Project-3D/blob/main/docs/guia-exposicion-atlas-3d.md).
