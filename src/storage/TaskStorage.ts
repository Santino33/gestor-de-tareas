import type { EncryptionConfig, Task } from "../models/Task";

const DB_NAME = "gestor-tareas-db";
const LEGACY_KEY = "electiva-pwa-tareas";

// Las promesas de escritura esperan a que termine la transacción, no solo la petición.
function requestInTransaction<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = operation(tx.objectStore(storeName));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error ?? new Error("Transacción cancelada"));
    tx.onerror = () => reject(tx.error);
  });
}

export class TaskStorage {
  private constructor(private readonly db: IDBDatabase) {}

  static open(): Promise<TaskStorage> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (event.oldVersion < 1) {
          const tasks = db.createObjectStore("tareas", { keyPath: "id" });
          tasks.createIndex("porPrioridad", "priority", { unique: false });
          db.createObjectStore("configuracion", { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(new TaskStorage(request.result));
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Cierra otras pestañas de la aplicación e inténtalo de nuevo."));
    });
  }

  getTasks(): Promise<Task[]> {
    return requestInTransaction(this.db, "tareas", "readonly", (store) => store.getAll());
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
      return;
    }
    if (!Array.isArray(parsed)) return;

    const existingIds = new Set((await this.getTasks()).map((task) => task.id));
    const missing = parsed.filter(isValidLegacyTask).filter((task) => !existingIds.has(task.id));
    if (missing.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db.transaction("tareas", "readwrite");
        const store = tx.objectStore("tareas");
        missing.forEach((task) => store.put(task));
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new Error("Importación cancelada"));
        tx.onerror = () => reject(tx.error);
      });
    }
    // Borrar la copia antigua solo después de confirmar la escritura en IndexedDB.
    localStorage.removeItem(LEGACY_KEY);
  }
}

function isValidLegacyTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  return typeof task.id === "string" && typeof task.title === "string" &&
    typeof task.completed === "boolean" && typeof task.createdAt === "string" &&
    (task.priority === "low" || task.priority === "medium" || task.priority === "high");
}
