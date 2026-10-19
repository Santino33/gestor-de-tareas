# Notas privadas cifradas en el Gestor de tareas

Este documento explica la implementación de la actividad **«Cifra un campo sensible del Gestor de tareas»**. Las referencias enlazadas indican el archivo y las líneas del **código fuente actual**; si se editan esos archivos más adelante, los números de línea pueden cambiar.

## 1. Qué cambió

Antes, la aplicación guardaba el arreglo completo de tareas como JSON en `localStorage`. Ahora cada tarea se guarda como un registro en IndexedDB. Los campos `title`, `priority`, `completed` y `createdAt` quedan legibles; la nota opcional se guarda únicamente como bytes cifrados (`noteCiphertext`) y su vector de inicialización (`noteIv`). La sal y el comprobante cifrado de la contraseña se guardan aparte. Véanse [el modelo de tarea (`src/models/Task.ts`, líneas 3–18)](../src/models/Task.ts#L3-L18) y [la estructura de IndexedDB (`src/storage/TaskStorage.ts`, líneas 27–42)](../src/storage/TaskStorage.ts#L27-L42).

El punto de entrada que ejecuta esta versión es [`src/main.ts`, líneas 18–23](../src/main.ts#L18-L23), incluido por [`index.html`, línea 43](../index.html#L43). Los archivos antiguos `app.js` y `tareas.js` no son el punto de entrada de esta aplicación.

## 2. Base de datos y persistencia

- **Apertura y esquema:** el [nombre de la base y la clave antigua (`src/storage/TaskStorage.ts`, líneas 3–4)](../src/storage/TaskStorage.ts#L3-L4) y la [apertura y creación del esquema (`src/storage/TaskStorage.ts`, líneas 27–42)](../src/storage/TaskStorage.ts#L27-L42). Se abre `gestor-tareas-db` con versión **1**. Dentro de `onupgradeneeded` se crean el almacén `tareas` con clave `id`, el índice `porPrioridad` sobre `priority`, y el almacén `configuracion` con clave `id`. El índice deja la prioridad consultable sin cifrar; la interfaz actual todavía no implementa un filtro visual que lo use.
- **Transacciones asíncronas:** [`src/storage/TaskStorage.ts`, líneas 6–22](../src/storage/TaskStorage.ts#L6-L22). `requestInTransaction` adapta un `IDBRequest` a una promesa. Para escrituras, la promesa termina cuando la **transacción se completa**, no solamente cuando la petición responde; un error o cancelación rechaza la promesa.
- **Operaciones sobre tareas:** [`src/storage/TaskStorage.ts`, líneas 44–58](../src/storage/TaskStorage.ts#L44-L58). `getAll` carga los registros, `add` crea uno, `put` actualiza uno y `delete` elimina uno.
- **Configuración criptográfica:** [`src/storage/TaskStorage.ts`, líneas 60–66](../src/storage/TaskStorage.ts#L60-L66). `getConfig` y `saveConfig` leen y escriben un registro con id `encryption`. Sus campos están definidos en [`src/models/Task.ts`, líneas 13–18](../src/models/Task.ts#L13-L18): sal, comprobante cifrado e IV del comprobante. **No se guarda la contraseña ni la clave derivada.**

### Migración desde `localStorage`

[`src/storage/TaskStorage.ts`, líneas 68–103](../src/storage/TaskStorage.ts#L68-L103) lee la antigua clave `electiva-pwa-tareas`, valida las tareas, evita importar IDs que ya existen y escribe las faltantes dentro de una transacción. Solo después de que esa transacción termina correctamente elimina la copia antigua de `localStorage`. La importación se invoca tras introducir la contraseña en [`src/services/TaskService.ts`, líneas 23–25](../src/services/TaskService.ts#L23-L25). Las tareas anteriores no tienen nota privada porque ese campo no existía en la versión antigua.

## 3. Contraseña y criptografía

### Preparación y comprobación

1. Al abrir, [`src/services/TaskService.ts`, líneas 11–25](../src/services/TaskService.ts#L11-L25) consulta si existe la configuración. Si no existe, exige una contraseña nueva de al menos **12 caracteres**, genera la configuración, la guarda y luego desbloquea la sesión.
2. [`src/services/NoteCrypto.ts`, líneas 31–37](../src/services/NoteCrypto.ts#L31-L37) genera una sal aleatoria de 16 bytes y cifra un texto comprobante conocido. Guarda la sal y el resultado cifrado, no el texto de la contraseña.
3. [`src/services/NoteCrypto.ts`, líneas 5–13](../src/services/NoteCrypto.ts#L5-L13) convierte la contraseña en material de clave y deriva una clave **AES-GCM de 256 bits** mediante **PBKDF2 con SHA-256 y 100 000 iteraciones**. La misma contraseña y la misma sal permiten reproducir la clave tras recargar la página. La clave se crea como no exportable.
4. [`src/services/NoteCrypto.ts`, líneas 39–48](../src/services/NoteCrypto.ts#L39-L48) intenta descifrar el comprobante para validar la contraseña. Si falla, comunica «Contraseña incorrecta». La clave utilizable queda solamente en la propiedad en memoria de [`src/services/NoteCrypto.ts`, líneas 28–29](../src/services/NoteCrypto.ts#L28-L29); al recargar se vuelve a derivar.

**Aclaración:** aquí SHA-256 se usa *dentro de PBKDF2*; no se guarda un hash independiente de la contraseña. El comprobante de desbloqueo está cifrado con AES-GCM.

### Cifrado de cada nota

[`src/services/NoteCrypto.ts`, líneas 15–26](../src/services/NoteCrypto.ts#L15-L26) genera un IV aleatorio de 12 bytes **para cada cifrado**, convierte el texto a bytes con `TextEncoder` y llama a `crypto.subtle.encrypt` con AES-GCM. Para descifrar usa los bytes cifrados, el IV correspondiente y `TextDecoder`. El IV no es secreto, pero no debe reutilizarse con la misma clave. Si la clave, el IV o los bytes cifrados no coinciden, el descifrado falla.

Los métodos públicos que requieren que las notas estén desbloqueadas están en [`src/services/NoteCrypto.ts`, líneas 50–58](../src/services/NoteCrypto.ts#L50-L58). El navegador debe servir la aplicación desde **HTTPS o localhost** para utilizar Web Crypto.

## 4. Flujo de una tarea

1. **Creación:** el formulario recoge título, prioridad y nota opcional en [`index.html`, líneas 26–39](../index.html#L26-L39). La vista los envía al servicio en [`src/views/TaskView.ts`, líneas 77–93](../src/views/TaskView.ts#L77-L93).
2. **Cifrar antes de escribir:** [`src/services/TaskService.ts`, líneas 28–39](../src/services/TaskService.ts#L28-L39) llama a `encryptNote` si se escribió una nota. El objeto persistido contiene `noteCiphertext` y `noteIv`, **no** una propiedad `notaPrivada` con el texto original. Cuando finaliza `addTask`, se incorpora la tarea a la lista en memoria.
3. **Marcar o eliminar:** [`src/services/TaskService.ts`, líneas 41–53](../src/services/TaskService.ts#L41-L53) actualiza o elimina un registro en IndexedDB antes de reflejar el cambio en la lista. La vista conecta ambas acciones en [`src/views/TaskView.ts`, líneas 95–118](../src/views/TaskView.ts#L95-L118).
4. **Leer bajo demanda:** [`src/services/TaskService.ts`, líneas 55–59](../src/services/TaskService.ts#L55-L59) descifra la nota seleccionada. [`src/views/TaskListView.ts`, líneas 46–74](../src/views/TaskListView.ts#L46-L74) muestra «Ver nota» solamente en tareas que la tienen, coloca el texto descifrado con `textContent` y permite ocultarlo. No se descifran todas las notas al cargar la lista. Al volver a renderizarla también desaparece cualquier nota que estaba visible.

## 5. Pantallas, inicio y caché

- **Desbloqueo:** el formulario de contraseña, confirmación y mensajes está en [`index.html`, líneas 17–24](../index.html#L17-L24). La sección de tareas empieza oculta en [`index.html`, línea 26](../index.html#L26).
- **Interacción:** [`src/views/TaskView.ts`, líneas 33–75](../src/views/TaskView.ts#L33-L75) decide si mostrar creación o ingreso de contraseña, confirma que ambas contraseñas nuevas coincidan, desbloquea, limpia los campos de contraseña y muestra las tareas. La visualización de errores está en [`src/views/TaskView.ts`, líneas 120–122](../src/views/TaskView.ts#L120-L122).
- **Inicio:** [`src/main.ts`, líneas 18–23](../src/main.ts#L18-L23) abre IndexedDB y construye el servicio y la vista; muestra un error si la apertura falla.
- **Estilos:** [`css/styles.css`, líneas 40–73](../css/styles.css#L40-L73) cubre formularios y controles; [`css/styles.css`, líneas 83–91](../css/styles.css#L83-L91) cubre el ajuste de tareas; [`css/styles.css`, líneas 129–138](../css/styles.css#L129-L138) cubre elementos ocultos, errores y nota privada visible.
- **Service worker:** [`src/sw.ts`, línea 1](../src/sw.ts#L1) establece la versión `gestor-tareas-v2`; [`src/sw.ts`, líneas 12–20](../src/sw.ts#L12-L20) borra cachés anteriores de la app al activarse, para que la versión antigua de la interfaz no quede servida desde el caché. El caché de recursos y IndexedDB cumplen funciones distintas.

La compilación genera además archivos en `dist/` mediante `npm run build`; los nombres de sus recursos llevan hashes y pueden cambiar entre compilaciones. Para estudiar la implementación conviene seguir las referencias al código fuente anteriores.

## 6. Cómo comprobar la actividad

1. Ejecuta `npm run dev` y abre la dirección **localhost** que indique Vite. Crea y confirma una contraseña de al menos 12 caracteres.
2. Crea una tarea con título, prioridad y una nota privada. Abre DevTools → **Application → IndexedDB → gestor-tareas-db → tareas**. El campo `noteCiphertext` debe verse como `ArrayBuffer` con datos ilegibles; `noteIv` también está guardado. Captura esta pantalla para la primera evidencia. El título y la prioridad se verán legibles a propósito.
3. Recarga la página. Ingresa la **misma** contraseña y pulsa **«Ver nota»** en esa tarea. Comprueba que aparece el texto original y captura la segunda evidencia.
4. Para comprobar el control de acceso, recarga e intenta ingresar otra contraseña: se debe mostrar «Contraseña incorrecta». Si se pierde la contraseña original, esta implementación no tiene recuperación de notas cifradas.

El cifrado protege el contenido almacenado frente a una lectura de los datos sin la contraseña. Una vez desbloqueada la página y mostrada una nota, su texto está visible en la interfaz; el cifrado local no protege frente a alguien con acceso a una sesión ya desbloqueada.
