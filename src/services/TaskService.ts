import type { Task } from "../models/Task";
import type { TaskStorage } from "../storage/TaskStorage";

export class TaskService {
  private tasks: Task[] = [];

  constructor(private readonly storage?: TaskStorage) {}

  loadTasks(): void {
    this.tasks = this.storage?.load() ?? [];
  }

  createTask(title: string, priority: Task["priority"]): Task {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title,
      priority,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    this.tasks.push(newTask);
    this.persist();
    return newTask;
  }

  toggleTask(id: string): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) {
      console.error(`Task with id ${id} not found.`);
      return;
    }
    task.completed = !task.completed;
    this.persist();
  }

  deleteTask(id: string): void {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    if (this.tasks.length === before) {
      console.error(`Task with id ${id} not found.`);
      return;
    }
    this.persist();
  }

  getTasks(): Task[] {
    return [...this.tasks];
  }

  private persist(): void {
    this.storage?.save(this.tasks);
  }
}
