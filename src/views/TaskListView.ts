import type { Task } from "../models/Task";

interface TaskListViewCallbacks {
  onToggle: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReadNote: (id: string) => Promise<string>;
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
    { onToggle, onDelete, onReadNote }: TaskListViewCallbacks
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
    deleteButton.textContent = "Eliminar";
    deleteButton.className = "delete-button";
    deleteButton.addEventListener("click", () => onDelete(task.id));

    listItem.append(checkbox, text);
    if (task.noteCiphertext) {
      const noteButton = document.createElement("button");
      noteButton.type = "button";
      noteButton.textContent = "Ver nota";
      noteButton.className = "note-button";
      const note = document.createElement("p");
      note.className = "private-note";
      note.hidden = true;
      noteButton.addEventListener("click", async () => {
        if (!note.hidden) {
          note.hidden = true;
          note.textContent = "";
          noteButton.textContent = "Ver nota";
          return;
        }
        try {
          note.textContent = await onReadNote(task.id);
          note.hidden = false;
          noteButton.textContent = "Ocultar nota";
        } catch {
          note.textContent = "No se pudo descifrar la nota.";
          note.hidden = false;
        }
      });
      listItem.append(noteButton, note);
    }
    listItem.append(deleteButton);
    return listItem;
  }
}
