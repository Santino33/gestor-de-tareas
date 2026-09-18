import type { Task, Priority } from "../models/Task";

export interface TaskStorage {
  load(): Task[];
  save(tasks: Task[]): void;
}

const STORAGE_KEY = "electiva-pwa-tareas";

export class LocalStorageTaskStorage implements TaskStorage {
  load(): Task[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidTask);
    } catch {
      return [];
    }
  }

  save(tasks: Task[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // cuota excedida o modo privado: persistencia no disponible
    }
  }
}

function isValidTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.title === "string" &&
    typeof obj.completed === "boolean" &&
    isPriority(obj.priority) &&
    typeof obj.createdAt === "string"
  );
}

function isPriority(value: unknown): value is Priority {
  return value === "low" || value === "medium" || value === "high";
}
