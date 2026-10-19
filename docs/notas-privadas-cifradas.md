# Notas privadas cifradas

## Persistencia

`src/storage/TaskStorage.ts` abre `gestor-tareas-db` v2. El store `tareas` usa
`id` como clave y los índices no únicos `porPrioridad` y `porFecha`. El store
`configuracion` conserva el registro `encryption`. Las actualizaciones v1→v2
preservan los datos y crean el segundo índice. Las conexiones cierran ante
`versionchange`; las aperturas bloqueadas piden cerrar otras pestañas y recargar.

`agregarTarea`, `obtenerTarea` y `eliminarTarea` adaptan cada IDBRequest a promesa.
Las operaciones no comunican éxito hasta `transactionDone`/`oncomplete`; un
aborto rechaza aunque una solicitud haya tenido éxito. La acción por prioridad
recorre `openCursor()` y confirma cada `IDBCursor.update()` antes de continuar;
todo el lote comparte transacción. No se espera WebCrypto dentro de una transacción.

La migración convierte `titulo/prioridad/completada/fechaCreacion` y
`baja/media/alta` al modelo actual. También acepta el formato inglés anterior.
Valida la lista completa, consulta IDs y agrega faltantes en una sola transacción.
Los datos inválidos se conservan para corregirlos; no se borran silenciosamente.
Solo tras commit se elimina la clave `electiva-pwa-tareas` de localStorage.

## Cifrado

`NoteCrypto` genera una sal aleatoria de 16 bytes una sola vez por configuración.
Deriva AES-GCM de 256 bits con PBKDF2/SHA-256: 600000 iteraciones para nuevas
configuraciones. Persiste versión, algoritmos e iteraciones. Configuraciones
históricas sin esos metadatos siguen usando 100000 iteraciones y la misma sal;
no se alteran sus claves ni se pierde acceso a notas anteriores.

La configuración guarda un comprobante cifrado y su IV, nunca contraseña ni
clave. La CryptoKey no exportable vive en memoria. Cada cifrado usa un nuevo IV
aleatorio de 12 bytes. Las notas opcionales guardan `noteCiphertext: ArrayBuffer`
y `noteIv: Uint8Array`. Título, prioridad, estado y fecha quedan legibles.
No se persiste la nota en claro como alternativa si falla el cifrado.

`TaskService.createTask` cifra antes de abrir la escritura; las tareas sin nota
siguen siendo válidas. `readNote` obtiene el registro por ID y descifra bajo demanda.
La vista inserta texto con `textContent` y lo elimina al ocultar o renderizar la lista.
Tras recargar hay que reintroducir contraseña; los campos se limpian al desbloquear.

Una contraseña incorrecta y un comprobante autenticado alterado pueden causar
el mismo error AES-GCM: el mensaje no pretende distinguirlos de forma infalible.
Configuraciones estructuralmente inválidas y notas dañadas tienen mensajes propios.
Se requiere HTTPS/localhost y WebCrypto. No hay recuperación de contraseña ni
protección frente a acceso a la sesión desbloqueada o scripts maliciosos del origen.

## Prueba funcional

1. Compilar y abrir Preview en localhost.
2. Crear contraseña y una tarea con nota; inspeccionar IndexedDB: texto solo en
   título/prioridad, nota como bytes e IV, configuración con sal y comprobante.
3. Recargar e introducir la misma contraseña; «Ver nota» debe mostrar el original.
4. Repetir con contraseña incorrecta: no debe desbloquear.
5. En un perfil de prueba, alterar un byte de ciphertext/IV: el descifrado falla.

`tests/crypto.spec.ts` cubre rederivación, IV distintos, corrupción y compatibilidad
histórica. `tests/offline.spec.ts` comprueba la recarga real en Chrome/Firefox,
contraseña errónea, almacenamiento cifrado y descifrado exacto sin conexión.
