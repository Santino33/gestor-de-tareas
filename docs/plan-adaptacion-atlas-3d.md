# Plan de implementación: prácticas de Atlas 3D en el Gestor de Tareas

**Estado:** implementación realizada; validación física en teléfono pendiente. Véase la [evidencia de la iteración](validacion-iteracion.md#adaptación-de-atlas-3d).

**Objetivo:** mejorar la experiencia sin conexión y evitar que el usuario pierda trabajo, sin cambiar la arquitectura del gestor ni añadir un backend.

## Alcance y punto de partida

| Referencia de Atlas 3D | Adaptación al gestor | Punto de partida |
| --- | --- | --- |
| S43: conservar borradores cuando cambia otra tarjeta | Proteger el título, la nota y la prioridad de la tarea en edición al cambiar la lista. | El formulario ya está separado de la lista; no se ha reproducido una pérdida de borrador en el gestor. |
| S41: comprobar la conexión con `fetch` y `AbortController` | Distinguir entre «sin red» y «el servidor del gestor no responde», sin bloquear el uso local. | El aviso actual se basa en `navigator.onLine`. |
| S41: instalación y aplazamiento | Añadir «Ahora no» y mejorar la detección del modo instalado y la ayuda manual en iOS. | Ya se usan `beforeinstallprompt`, `appinstalled` y el modo `standalone`. |
| S42 y S45: checklist común y Lighthouse | Ampliar la cobertura de Playwright y comparar el mismo flujo antes y después. | Ya hay pruebas de migración, modo offline, instalación y actualización; se amplían donde falten casos. |

Se conservan TypeScript sin framework, Vite, IndexedDB, Web Crypto, el manifiesto y Workbox `GenerateSW`. No se incorporan Three.js, WebXR, cámara, sensores, React, Angular ni Background Sync. `InjectManifest` queda fuera de esta iteración: solo se evaluaría si una función futura requiere lógica propia en el Service Worker.

## Fases de implementación

### 0. Registrar la línea base

- [x] Ejecutar `npm run build` y `npm test` antes de modificar el código. Registrar versiones de navegador, resultados y limitaciones del entorno.
- [x] Servir el build de producción con `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort` y medir con `npm run audit:lighthouse -- atlas-base`. Usar la misma configuración, origen y versión de Chrome para la medición final. Si es posible, hacer tres corridas en frío por versión con etiquetas distintas y comparar medianas.
- [x] Revisar la matriz de [validación previa](validacion-iteracion.md) para no duplicar pruebas ni dar por hecha la instalación en un teléfono.

### 1. Proteger borradores sin guardar

- [x] En [`tests/ux.spec.ts`](../tests/ux.spec.ts), comprobar que título, nota y prioridad se conservan al filtrar, completar otra tarea o fallar el guardado, y que se limpian al guardar correctamente.
- [x] Las pruebas pasaron antes de modificar la aplicación; no hubo que cambiar [`TaskView.ts`](../src/views/TaskView.ts) ni [`TaskListView.ts`](../src/views/TaskListView.ts).
- [x] Mantener el borrador en memoria, sin guardar notas en claro ni contraseñas. Cancelar la actualización del SW conserva el borrador; confirmar permite descartarlo.

**Criterio de aceptación:** las acciones sobre la lista no alteran el formulario; cancelar una actualización con texto no recarga la página ni borra el borrador.

### 2. Verificar la disponibilidad del servidor

- [x] Añadir [`public/red.txt`](../public/red.txt) con un marcador fijo. Consultarlo desde [`src/connectivity.ts`](../src/connectivity.ts), inicializado por `pwa.ts`, con `fetch`, `cache: "no-store"` y un plazo de 3 segundos mediante `AbortController`. Validar el estado HTTP y el marcador para no confundir una respuesta HTML de fallback con una comprobación exitosa.
- [x] Mantener la ruta fuera del precaché y de las reglas de caché del Service Worker en [`workbox-config.js`](../workbox-config.js). El resultado indica si responde el origen del gestor, no si «hay Internet» en general.
- [x] Comprobar al iniciar y cuando vuelva la red. Al recibir `offline`, cancelar la petición e ignorar respuestas de comprobaciones anteriores. No usar sondeo continuo.
- [x] Probar respuesta válida, error HTTP, respuesta inesperada, vencimiento del plazo y transición rápida entre estados.

**Criterio de aceptación:** el aviso distingue «sin red», «servidor accesible» y «servidor no accesible». El usuario puede seguir creando y completando tareas aunque falle la comprobación.

### 3. Mejorar la instalación

- [x] En [`src/install.ts`](../src/install.ts) e [`index.html`](../index.html), mostrar «Instalar» solo cuando exista un prompt nativo utilizable. Sin él, ofrecer ayuda manual en Safari/iOS («Compartir → Añadir a pantalla de inicio») sin prometer que todos los navegadores muestran esa opción.
- [x] Añadir «Ahora no» para ocultar la sugerencia durante siete días, guardando solo la fecha de aplazamiento en `localStorage`. No bloquear la instalación desde el menú del navegador ni romper la app si el almacenamiento no está disponible.
- [x] Ocultar la sugerencia en modo instalado o tras `appinstalled`. Distinguir «instalación solicitada» de «app instalada» y evitar que un mensaje de instalación oculte el aviso de actualización.
- [x] Verificar el prompt y sus estados con Playwright, incluida la recarga después de aplazar y el vencimiento del plazo. La validación manual de Safari/iOS queda pendiente por falta de dispositivo.

**Criterio de aceptación:** la sugerencia no reaparece durante el aplazamiento aunque se recargue la página, no se ofrece dentro de la app instalada y no aparece un botón nativo que no pueda funcionar.

### 4. Validar el conjunto y documentar resultados

- [x] Ejecutar `npm run build` y `npm test`. Repetir las pruebas de migración IndexedDB y cifrado sin cambiar el esquema. En los flujos de navegador, verificar la recarga offline tras el primer acceso, la lectura de notas guardadas y la actualización consentida con un SW nuevo.
- [x] Ejecutar tres corridas con etiquetas `atlas-final-1` a `atlas-final-3` en las mismas condiciones de la línea base. Comparar rendimiento, accesibilidad, buenas prácticas, SEO y métricas de carga, y documentar la diferencia de LCP.
- [ ] Probar en un teléfono con HTTPS: instalar, crear una tarea con nota, cerrar, activar modo avión, volver a abrir y desbloquear la nota. Registrar el navegador, el dispositivo y cualquier caso no ejecutado.
- [x] Actualizar el README y la [evidencia de validación](validacion-iteracion.md) con el comportamiento entregado, resultados y limitaciones.

## Condición de cierre

La iteración se puede cerrar cuando pasen las pruebas automatizadas de los flujos existentes y los nuevos, no queden regresiones reproducibles sin resolver o justificar, y cada comprobación manual esté registrada como aprobada, fallida o pendiente. Los cambios no requieren migrar datos ni modificar el cifrado.

**Referencia:** [Resumen de tecnologías de Atlas 3D por sesión](../resumen-tecnologias-atlas-3d.md).
