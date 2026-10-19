import type { EncryptionConfig, Task } from "../models/Task";

const DB_NAME = "gestor-tareas-db";
const LEGACY_KEY = "electiva-pwa-tareas";

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Error de IndexedDB"));
  });
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Transacción cancelada"));
    // El error de una petición provoca aborto por defecto; esperar ese estado final.
  });
}

async function requestInTransaction<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const tx = db.transaction(storeName, mode);
  const done = transactionDone(tx);
  try {
    const [result] = await Promise.all([requestResult(operation(tx.objectStore(storeName))), done]);
    return result;
  } catch (error) {
    try { tx.abort(); } catch { /* Ya finalizada. */ }
    await done.catch(() => undefined);
    throw error;
  }
}

export class TaskStorage {
  private constructor(private readonly db: IDBDatabase) {}

  close(): void { this.db.close(); }

  static open(onVersionChange?: () => void): Promise<TaskStorage> {
    return new Promise((resolve, reject) => {
      let blocked = false;
      const request = indexedDB.open(DB_NAME, 2);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (event.oldVersion < 1) {
          const tasks = db.createObjectStore("tareas", { keyPath: "id" });
          tasks.createIndex("porPrioridad", "priority", { unique: false });
          db.createObjectStore("configuracion", { keyPath: "id" });
        }
        if (event.oldVersion < 2) {
          request.transaction!.objectStore("tareas").createIndex("porFecha", "createdAt");
        }
      };
      request.onsuccess = () => {
        if (blocked) { request.result.close(); return; }
        request.result.onversionchange = () => {
          request.result.close();
          onVersionChange?.();
        };
        resolve(new TaskStorage(request.result));
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        blocked = true;
        reject(new Error("Cierra otras pestañas de la aplicación y recarga."));
      };
    });
  }

  getTasks(): Promise<Task[]> {
    return requestInTransaction(this.db, "tareas", "readonly", (store) => store.index("porFecha").getAll());
  }

  addTask(task: Task): Promise<IDBValidKey> {
    return requestInTransaction(this.db, "tareas", "readwrite", (store) => store.add(task));
  }

  updateTask(task: Task): Promise<IDBValidKey> {
    return requestInTransaction(this.db, "tareas", "readwrite", (store) => store.put(task));
  }

  deleteTask(id: string): Promise<undefined> {
    return requestInTransaction(this.db, "tareas", "readwrite", (store) => store.delete(id));
  }

  getConfig(): Promise<EncryptionConfig | undefined> {
    return requestInTransaction(this.db, "configuracion", "readonly", (store) => store.get("encryption"));
  }

  saveConfig(config: EncryptionConfig): Promise<IDBValidKey> {
    return requestInTransaction(this.db, "configuracion", "readwrite", (store) => store.add(config));
  }

  async importLegacyTasks(): Promise<void> {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw === null) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Los datos anteriores no son JSON válido; se conservaron sin modificar.");
    }
    if (!Array.isArray(parsed)) throw new Error("El formato anterior no es una lista; se conservó la copia.");
    const tasks = parsed.map(normalizeLegacyTask);
    if (tasks.some((task) => !task)) throw new Error("Hay tareas anteriores inválidas; se conservó la copia completa.");
    const tx = this.db.transaction("tareas", "readwrite");
    const done = transactionDone(tx);
    try {
      const store = tx.objectStore("tareas");
      // Leer y escribir en la misma transacción evita carreras entre pestañas.
      for (const task of tasks as Task[]) {
        if (!(await requestResult(store.get(task.id)))) await requestResult(store.add(task));
      }
      await done;
    } catch (error) {
      try { tx.abort(); } catch { /* Ya abortada. */ }
      await done.catch(() => undefined);
      throw error;
    }
    // Borrar la copia antigua solo después de confirmar la escritura en IndexedDB.
    localStorage.removeItem(LEGACY_KEY);
  }
}

function normalizeLegacyTask(value: unknown): Task | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const task = value as Record<string, unknown>;
  const title = task.title ?? task.titulo;
  const completed = task.completed ?? task.completada;
  const createdAt = task.createdAt ?? task.fechaCreacion;
  const priorities: Record<string, Task["priority"]> = { baja: "low", media: "medium", alta: "high" };
  const priority = task.priority ?? priorities[String(task.prioridad)];
  if (typeof task.id !== "string" || !task.id || typeof title !== "string" ||
    typeof completed !== "boolean" || typeof createdAt !== "string" || !Number.isFinite(Date.parse(createdAt)) ||
    (priority !== "low" && priority !== "medium" && priority !== "high")) return undefined;
  return { id: task.id, title, completed, createdAt, priority };
}
