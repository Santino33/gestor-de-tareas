import type { Priority } from "../models/Task";
import { TaskService } from "../services/TaskService";
import { TaskListView } from "./TaskListView";

const DEFAULT_PRIORITY: Priority = "medium";

function parsePriority(value: string): Priority {
  switch (value) {
    case "low":
    case "medium":
    case "high":
      return value;
    default:
      return DEFAULT_PRIORITY;
  }
}

export class TaskView {
  private readonly form: HTMLFormElement;
  private readonly titleInput: HTMLInputElement;
  private readonly prioritySelect: HTMLSelectElement;
  private readonly taskListView: TaskListView;

  constructor(private readonly taskService: TaskService) {
    this.form = document.querySelector("#task-form")!;
    this.titleInput = document.querySelector("#title-input")!;
    this.prioritySelect = document.querySelector("#priority-select")!;

    const taskList = document.querySelector<HTMLUListElement>("#task-list")!;
    this.taskListView = new TaskListView(taskList);
  }

  initialize(): void {
    this.form.addEventListener("submit", (event) => {
      this.handleSubmit(event);
    });

    this.taskService.loadTasks();
    this.renderTasks();
  }

  private handleSubmit(event: SubmitEvent): void {
    event.preventDefault();

    const title = this.titleInput.value.trim();
    const priority = parsePriority(this.prioritySelect.value);

    if (!title) return;

    this.taskService.createTask(title, priority);
    this.form.reset();
    this.renderTasks();
  }

  private renderTasks(): void {
    const tasks = this.taskService.getTasks();

    this.taskListView.render(tasks, {
      onToggle: (id) => {
        this.taskService.toggleTask(id);
        this.renderTasks();
      },
      onDelete: (id) => {
        this.taskService.deleteTask(id);
        this.renderTasks();
      },
    });
  }
}
