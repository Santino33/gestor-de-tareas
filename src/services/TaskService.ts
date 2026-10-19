import type { Task } from "../models/Task";
import { TaskStorage } from "../storage/TaskStorage";
import { NoteCrypto } from "./NoteCrypto";

export class TaskService {
  private tasks: Task[] = [];
  private readonly notes = new NoteCrypto();

  constructor(private readonly storage: TaskStorage) {}

  async hasPassword(): Promise<boolean> {
    return (await this.storage.getConfig()) !== undefined;
  }

  async unlock(password: string): Promise<void> {
    if (!password) throw new Error("Ingresa una contraseña");
    let config = await this.storage.getConfig();
    if (!config) {
      if (password.length < 12) throw new Error("La contraseña nueva debe tener al menos 12 caracteres");
      config = await this.notes.createConfig(password);
      await this.storage.saveConfig(config);
    }
    await this.notes.unlock(password, config);
    await this.storage.importLegacyTasks();
    this.tasks = await this.storage.getTasks();
  }

  async createTask(title: string, priority: Task["priority"], privateNote: string): Promise<void> {
    const encrypted = privateNote
      ? await this.notes.encryptNote(privateNote)
      : undefined;
    const task: Task = {
      id: crypto.randomUUID(), title, priority, completed: false,
      createdAt: new Date().toISOString(),
      ...(encrypted && { noteCiphertext: encrypted.ciphertext, noteIv: encrypted.iv }),
    };
    await this.storage.addTask(task);
    this.tasks.push(task);
  }

  async toggleTask(id: string): Promise<void> {
    const task = this.tasks.find((item) => item.id === id);
    if (!task) throw new Error("Tarea no encontrada");
    const updated = { ...task, completed: !task.completed };
    await this.storage.updateTask(updated);
    this.tasks = this.tasks.map((item) => item.id === id ? updated : item);
  }

  async deleteTask(id: string): Promise<void> {
    if (!this.tasks.some((task) => task.id === id)) throw new Error("Tarea no encontrada");
    await this.storage.deleteTask(id);
    this.tasks = this.tasks.filter((task) => task.id !== id);
  }

  async readNote(id: string): Promise<string> {
    const task = this.tasks.find((item) => item.id === id);
    if (!task?.noteCiphertext || !task.noteIv) throw new Error("Esta tarea no tiene nota privada");
    return this.notes.decryptNote(task.noteCiphertext, task.noteIv);
  }

  getTasks(): Task[] {
    return [...this.tasks];
  }
}
