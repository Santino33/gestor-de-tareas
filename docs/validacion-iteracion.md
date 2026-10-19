# Evidencia de la iteración

Fecha: 2026-10-19. Entorno: Linux, Node 24.18.0, npm 11.16.0,
Chrome 155.0.8059.84, Lighthouse 13.5.0, Playwright 1.64.1.

## Resultados ejecutados

- `npm ci`, `npm ls --depth=0`: instalación reproducible y versiones alineadas.
- `npm run build`: typecheck, Vite y Workbox correctos.
- `npx workbox generateSW workbox-config.js` (también vía `build:sw`):
  **6 URL, 35.8 kB** en la compilación final; la primera versión Workbox midió
  6 URL, 31.2 kB, antes de añadir UX. Son cifras de salida real del CLI.
- `npm test`: **11 pruebas aprobadas**, cinco unitarias, cuatro Chrome y dos Firefox.
- `TEST_WEBKIT=1 npm test -- --project=webkit tests/offline.spec.ts`: bloqueado antes
  de abrir la aplicación por bibliotecas del host (`libicu74`, `libjpeg-turbo8`,
  `gstreamer1.0-libav`). No se declara compatible por haber descargado el navegador.

## Lighthouse: línea base y dos rondas

Mismo origen `http://127.0.0.1:4173/`, modo navegación móvil predeterminado,
Chrome headless, almacenamiento limpio del auditor. Son mediciones locales
individuales, no medianas de múltiples dispositivos ni métricas de usuarios reales.

| Medición UTC | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS |
|---|---:|---:|---:|---:|---|---|---|---:|
| Base 17:55:08 | 100 | 95 | 96 | 82 | 0.9 s | 0.9 s | 0 ms | 0 |
| Ronda 1 18:02:20 | 100 | 100 | 100 | 91 | 0.9 s | 1.1 s | 0 ms | 0.011 |
| Final 18:04:33 | 100 | 100 | 100 | 100 | 0.9 s | 0.9 s | 0 ms | 0.022 |

Hallazgos iniciales: `errors-in-console`, `color-contrast`, `meta-description`,
`robots-txt`. Correcciones: icono/favicon válido, contraste legible, etiquetas,
descripción y `public/robots.txt` (evita que el fallback HTML se interprete como robots).
Quedan recomendaciones informativas sobre árbol de dependencias de red y CSS
bloqueante; no se sacrificó la hoja de estilos por perseguir una puntuación.

Los informes de las primeras rondas están en `/tmp/opencode/lighthouse-before.json`
y `/tmp/opencode/lighthouse-after.json` en el entorno de ejecución. El informe
final completo está en `reports/final.report.json` y `.html`. Este resumen se
versiona para conservar puntuaciones y hallazgos; los informes regenerables no.
Usar `npm run audit:lighthouse -- nombre` y `scripts/summarize-lighthouse.js`
para repetir. Lighthouse 13 no aporta la antigua categoría PWA; se verificó
instalabilidad mediante CDP y flujos offline mediante Playwright por separado.

## Matriz de comprobaciones

| Caso | Evidencia | Estado |
|---|---|---|
| Upgrade IndexedDB v1→v2 e índices | `storage.spec.ts` | Aprobado |
| Migración española, IDs repetidos, datos inválidos conservados | `storage.spec.ts` | Aprobado |
| Solicitud exitosa seguida de aborto revierte escritura | `storage.spec.ts` | Aprobado |
| CRUD, filtro por índice, orden por fecha, cursor idempotente | `storage.spec.ts`, `ux.spec.ts` | Aprobado |
| Sal estable, IV nuevo, corrupción y claves históricas | `crypto.spec.ts` | Aprobado |
| Cifrado en DB, contraseña errónea, recarga y descifrado | Chrome y Firefox, `offline.spec.ts` | Aprobado |
| HTML/JS/CSS offline incluso sin caché runtime de navegación | Chrome y Firefox, `offline.spec.ts` | Aprobado |
| Dos rutas runtime reciben peticiones y guardan respuestas | `offline.spec.ts` | Aprobado |
| Conectividad y contrato del prompt simulado | Chrome/Firefox, `ux.spec.ts` | Aprobado |
| Prompt nativo y manifiesto instalable | Chrome con perfil persistente, `install.spec.ts` | Aprobado |
| Actualización SW real, borrador y conservación IndexedDB | Chrome, `update.spec.ts` | Aprobado |
| Safari/iOS y aplicación instalada desde el sistema operativo | Requiere dispositivo real | Pendiente manual |
| WebKit automatizado | Faltan bibliotecas del host | Bloqueado por entorno |

El primer intento de instalación en Playwright devolvió `in-incognito`, una
restricción legítima de Chrome. La prueba final usa un perfil normal temporal,
obtiene lista vacía de errores de instalabilidad y manifiesto, y comprueba que
el botón aparece por el evento real. Guarda `install-button.png` en su carpeta
de `test-results/`. No instala una aplicación en el sistema operativo del usuario.

## Checklist de entrega y pasos manuales restantes

- [x] SW JavaScript, configuración real, sin entrada ni compilación SW TypeScript.
- [x] IndexedDB como persistencia única activa, dos índices usados, CRUD prometido,
      confirmación/aborto de transacciones y actualización real con cursor.
- [x] Derivación reproducible, cifrado autenticado, sal persistida, claves solo
      en memoria, datos existentes compatibles y errores visibles sin texto claro.
- [x] Workbox precaching/routing/strategies/expiration y window; dos runtimeCaching,
      expiración y comando CLI con cifras observadas.
- [x] Offline, instalación compatible, conectividad orientativa, carga/éxito/error,
      actualización consentida y mediciones Lighthouse antes/después.
- [x] Pruebas reales en Chrome y Firefox, diferencias de soporte documentadas.
- [ ] En Safari/iOS: servir HTTPS, crear tarea/nota, añadir a inicio con Compartir,
      cerrar/reabrir, modo avión, desbloquear y verificar CRUD/nota persistida.
- [ ] En dispositivo Chromium: aceptar instalación nativa, abrir standalone y
      repetir el flujo offline. La prueba automática verifica elegibilidad y botón.
- [ ] Repetir WebKit en host soportado con dependencias instaladas; WebKit de
      Playwright no reemplaza por sí solo la prueba de instalación de Safari.

`navigator.onLine` indica estado de red del dispositivo, no alcanzabilidad de Internet.
Un contexto HTTP remoto no equivale a localhost: verificar `window.isSecureContext`,
`crypto.subtle`, `navigator.serviceWorker`, scope, control y manifest en DevTools.
Sin `beforeinstallprompt`, usar instrucciones del navegador; no simular un botón
que prometa una instalación nativa inexistente.

## Dependencias y límites conocidos

`npm audit --omit=dev`: 0 vulnerabilidades. `npm audit`: seis avisos transitivos de
desarrollo (cuatro high, dos low), cadena Workbox CLI→chokidar/braces e
inquirer/external-editor/tmp. La remediación automática propone bajar de versión
mayor de Workbox; no se aplicó `--force`. No se ejecuta wizard ni watch con entrada
externa; el build consume patrones locales fijos. Revisar actualización upstream.

La base y las cachés pueden ser eliminadas por el usuario o por políticas de espacio
del navegador; no hay exportación, recuperación de contraseña ni sincronización.
El despliegue actual asume raíz `/`, no subcarpeta. Cambiar ese contrato requiere
alinear base Vite, registro SW, scope/start_url y reglas runtime.
