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
  private readonly form = document.querySelector<HTMLFormElement>("#task-form")!;
  private readonly passwordForm = document.querySelector<HTMLFormElement>("#password-form")!;
  private readonly passwordInput = document.querySelector<HTMLInputElement>("#password-input")!;
  private readonly passwordConfirm = document.querySelector<HTMLInputElement>("#password-confirm")!;
  private readonly message = document.querySelector<HTMLParagraphElement>("#message")!;
  private readonly taskSection = document.querySelector<HTMLElement>("#task-section")!;
  private readonly titleInput = document.querySelector<HTMLInputElement>("#title-input")!;
  private readonly noteInput = document.querySelector<HTMLTextAreaElement>("#note-input")!;
  private readonly prioritySelect = document.querySelector<HTMLSelectElement>("#priority-select")!;
  private readonly taskListView = new TaskListView(document.querySelector<HTMLUListElement>("#task-list")!);
  private creatingPassword = false;

  constructor(private readonly taskService: TaskService) {}

  async initialize(): Promise<void> {
    this.passwordForm.addEventListener("submit", (event) => { void this.handlePassword(event); });
    this.form.addEventListener("submit", (event) => { void this.handleSubmit(event); });
    try {
      const hasPassword = await this.taskService.hasPassword();
      this.creatingPassword = !hasPassword;
      document.querySelector("#password-label")!.textContent = hasPassword
        ? "Ingresa tu contraseña para desbloquear las notas"
        : "Crea una contraseña para cifrar tus notas privadas";
      document.querySelector("#password-submit")!.textContent = hasPassword ? "Desbloquear" : "Crear contraseña";
      this.passwordInput.autocomplete = hasPassword ? "current-password" : "new-password";
      this.passwordInput.minLength = hasPassword ? 1 : 12;
      document.querySelector<HTMLElement>("#confirm-label")!.hidden = hasPassword;
      this.passwordConfirm.hidden = hasPassword;
      this.passwordConfirm.required = !hasPassword;
      this.passwordConfirm.minLength = 12;
      this.passwordForm.hidden = false;
    } catch (error) {
      this.showError(error);
    }
  }

  private async handlePassword(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const button = this.passwordForm.querySelector<HTMLButtonElement>("button")!;
    button.disabled = true;
    this.message.textContent = "";
    try {
      if (this.creatingPassword && this.passwordInput.value !== this.passwordConfirm.value) {
        throw new Error("Las contraseñas no coinciden");
      }
      await this.taskService.unlock(this.passwordInput.value);
      this.passwordInput.value = "";
      this.passwordConfirm.value = "";
      this.passwordForm.hidden = true;
      this.taskSection.hidden = false;
      this.renderTasks();
    } catch (error) {
      this.showError(error);
    } finally {
      button.disabled = false;
    }
  }

  private async handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const title = this.titleInput.value.trim();
    if (!title) return;
    const button = this.form.querySelector<HTMLButtonElement>("button")!;
    button.disabled = true;
    try {
      await this.taskService.createTask(title, parsePriority(this.prioritySelect.value), this.noteInput.value);
      this.form.reset();
      this.message.textContent = "";
      this.renderTasks();
    } catch (error) {
      this.showError(error);
    } finally {
      button.disabled = false;
    }
  }

  private renderTasks(): void {
    this.taskListView.render(this.taskService.getTasks(), {
      onToggle: async (id) => {
        try {
          await this.taskService.toggleTask(id);
          this.message.textContent = "";
          this.renderTasks();
        } catch (error) {
          this.showError(error);
          this.renderTasks();
        }
      },
      onDelete: async (id) => {
        try {
          await this.taskService.deleteTask(id);
          this.message.textContent = "";
          this.renderTasks();
        } catch (error) {
          this.showError(error);
        }
      },
      onReadNote: (id) => this.taskService.readNote(id),
    });
  }

  showError(error: unknown): void {
    this.message.textContent = error instanceof Error ? error.message : "Ocurrió un error de almacenamiento";
  }
}
