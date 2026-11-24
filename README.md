# Gestor de tareas · PWA

TypeScript sin framework, Vite, IndexedDB y WebCrypto. **El Service Worker es JavaScript**, generado por Workbox CLI; no existe una versión TypeScript del SW.

## Preparación (paso 0)

Node >=22.12 (verificado con 24.18), npm y Google Chrome para las pruebas de instalación.

```sh
npm ci
npx playwright install firefox
npm run typecheck
```

Las versiones exactas y dependencias transitivas están en `package-lock.json`. `node_modules/` y `dist/` no se versionan. Workbox CLI, TypeScript, Vite, Playwright, fake-indexeddb y Lighthouse son herramientas de desarrollo; `workbox-window` es dependencia de la aplicación.

## Ejecutar

```sh
npm run dev
```

Para probar **PWA, instalación y offline**, usar producción:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Abrir `http://127.0.0.1:4173/`. El SW se registra solamente en producción. Servir el despliegue desde HTTPS y en la raíz del origen (las rutas del manifiesto y SW son absolutas). No abrir `index.html` con `file://` ni servir directamente los fuentes con un servidor sin Vite.

## Funciones

- Agregar, completar y eliminar tareas; listado por fecha y filtro de prioridad.
- Completar todas las pendientes de la prioridad elegida mediante cursor IndexedDB.
- Notas opcionales cifradas antes de persistir; contraseña al iniciar, descifrado bajo demanda.
- Importación del formato legado español de `localStorage`, sin sobrescribir IDs existentes.
- Al iniciar o recuperar la red, el gestor comprueba si responde su propio servidor. La comprobación no bloquea tareas ni indica si Internet funciona en general.
- Instalación cuando el navegador emite `beforeinstallprompt`; ayuda manual si no hay diálogo nativo (en Safari/iOS: **Compartir → Añadir a pantalla de inicio**). **Ahora no** oculta la sugerencia durante siete días en ese navegador sin impedir instalar desde el menú.
- El título, la nota privada y la prioridad del borrador se conservan al filtrar, completar otra tarea o fallar el guardado. El borrador permanece en memoria: una recarga no recupera texto sin guardar.
- Aviso de actualización con consentimiento y comprobación de formularios sin guardar.

Los datos son locales al origen y perfil del navegador: no hay backend ni sincronización remota. La contraseña y la clave derivada no se guardan. Perder la contraseña impide recuperar las notas; eliminar los datos del sitio elimina también tareas y sal. El cifrado de almacenamiento no protege una sesión ya desbloqueada.

## Arquitectura

- `src/main.ts`: inicialización de almacenamiento y vista.
- `src/storage/TaskStorage.ts`: IndexedDB v2, migración, transacciones, índices y cursor.
- `src/services/TaskService.ts`: operaciones y estado de lista.
- `src/services/NoteCrypto.ts`: PBKDF2 y AES-GCM.
- `src/views/`: DOM, formularios y acciones de tareas.
- `src/pwa.ts`: registro, avisos y actualización consentida con `workbox-window`.
- `src/connectivity.ts` y `src/install.ts`: comprobación del servidor y sugerencias de instalación.
- `workbox-config.js`: configuración ESM leída directamente por el CLI con Node >=22.12; exportaciones nombradas, sin `default`.
- `public/sw-cleanup.js`: complemento JavaScript de activación; no añade rutas ni `fetch`.
- `app.js`, `tareas.js`, `referencia-typescript/`: referencia histórica, no se cargan en la aplicación activa.

## Caché y generación del SW

`npm run build` comprueba tipos, compila Vite y ejecuta `npm run build:sw`. Para regenerar después de una compilación:

```sh
npx workbox generateSW workbox-config.js
```

La terminal informa la cantidad de URL y kB: conservar esa salida para cada entrega. No editar `dist/sw.js` manualmente.

| Recurso | Estrategia |
|---|---|
| `index.html`, bundles JS/CSS con hash, iconos 192/512/maskable | Precache revisionado; se descarga al instalar SW |
| Navegaciones no resueltas por precache (por ejemplo `/`) | NetworkFirst; 3 s de timeout, 5 entradas, 1 día; fallback al `index.html` precargado |
| `/manifest.json` | StaleWhileRevalidate; 1 entrada, 7 días; petición explícita al obtener control del SW |
| `/red.txt` | Petición directa sin caché del navegador ni del SW, con plazo de 3 s; nunca contiene datos del usuario |

GenerateSW incluye `workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration` y sus plugins según estas opciones. Las dos reglas runtime están verificadas con peticiones reales. El manifiesto **no es parte del precache**; queda disponible offline después de esa petición controlada. `sw-cleanup.js` se descarga como dependencia del worker. Ni tareas ni notas pasan por Cache Storage. Solo se eliminan cachés del esquema manual `gestor-tareas-vN`, no IndexedDB ni cachés de otras aplicaciones.

## Validaciones

```sh
npm run build
npm test
# Lighthouse necesita preview en otra terminal:
npm run audit:lighthouse -- medicion
node scripts/summarize-lighthouse.js reports/medicion.report.json
```

Playwright usa Chrome y Firefox, además de pruebas de almacenamiento/cifrado. Arranca Preview si no está en ejecución. La prueba de instalación crea y elimina su propio perfil normal: en incógnito Chrome no ofrece instalación. Los reportes Lighthouse JSON/HTML se escriben en `reports/`; trazas y captura del botón de instalación en `test-results/`.

WebKit es optativo porque requiere bibliotecas del sistema:

```sh
npx playwright install webkit
# En un sistema soportado, instalar sus dependencias según Playwright.
TEST_WEBKIT=1 npm test -- --project=webkit
```

Resultados, limitaciones y verificaciones manuales pendientes: [evidencia de validación](docs/validacion-iteracion.md). Alcance y criterios: [plan de adaptación de Atlas 3D](docs/plan-adaptacion-atlas-3d.md).
