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
    if (!tasks.length) {
      const empty = document.createElement("li");
      empty.textContent = "No hay tareas para esta selección.";
      this.taskListElement.append(empty);
    }

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
    checkbox.setAttribute("aria-label", `Completar ${task.title}`);
    checkbox.addEventListener("change", () => onToggle(task.id));

    const text = document.createElement("span");
    text.textContent = task.title;

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Eliminar";
    deleteButton.className = "delete-button";
    deleteButton.setAttribute("aria-label", `Eliminar ${task.title}`);
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
      note.id = `note-${task.id}`;
      note.setAttribute("role", "status");
      noteButton.setAttribute("aria-controls", note.id);
      noteButton.setAttribute("aria-expanded", "false");
      noteButton.addEventListener("click", async () => {
        if (!note.hidden) {
          note.hidden = true;
          note.textContent = "";
          noteButton.textContent = "Ver nota";
          noteButton.setAttribute("aria-expanded", "false");
          return;
        }
        try {
          noteButton.disabled = true;
          noteButton.textContent = "Descifrando…";
          noteButton.setAttribute("aria-busy", "true");
          note.textContent = await onReadNote(task.id);
          note.hidden = false;
          noteButton.textContent = "Ocultar nota";
          noteButton.setAttribute("aria-expanded", "true");
        } catch {
          note.textContent = "No se pudo descifrar la nota.";
          note.hidden = false;
          noteButton.textContent = "Ocultar nota";
          noteButton.setAttribute("aria-expanded", "true");
        } finally {
          noteButton.disabled = false;
          noteButton.setAttribute("aria-busy", "false");
        }
      });
      listItem.append(noteButton, note);
    }
    listItem.append(deleteButton);
    return listItem;
  }
}
