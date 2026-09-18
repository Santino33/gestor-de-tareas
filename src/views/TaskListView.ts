import type { Task } from "../models/Task";

interface TaskListViewCallbacks {
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export class TaskListView {
  constructor(private readonly taskListElement: HTMLUListElement) {}

  public render(tasks: Task[], callbacks: TaskListViewCallbacks): void {
    this.taskListElement.innerHTML = "";

    tasks.forEach((task) => {
      const listItem = this.createTaskElement(task, callbacks);
      this.taskListElement.append(listItem);
    });
  }

  private createTaskElement(
    task: Task,
    { onToggle, onDelete }: TaskListViewCallbacks
  ): HTMLLIElement {
    const listItem = document.createElement("li");

    listItem.className =
      `task task--${task.priority}` +
      (task.completed ? " task--completed" : "");

    listItem.dataset.id = task.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", () => onToggle(task.id));

    const text = document.createElement("span");
    text.textContent = task.title;

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.className = "delete-button";
    deleteButton.addEventListener("click", () => onDelete(task.id));

    listItem.append(checkbox, text, deleteButton);
    return listItem;
  }
}
