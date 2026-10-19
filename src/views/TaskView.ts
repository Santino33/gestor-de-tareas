import type { Priority } from "../models/Task";
import { TaskService } from "../services/TaskService";
import { TaskListView } from "./TaskListView";

function parsePriority(value: string): Priority {
  return value === "low" || value === "high" ? value : "medium";
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
  private readonly filter = document.querySelector<HTMLSelectElement>("#priority-filter")!;
  private readonly complete = document.querySelector<HTMLButtonElement>("#complete-priority")!;
  private readonly taskListView = new TaskListView(document.querySelector<HTMLUListElement>("#task-list")!);
  private creatingPassword = false;
  private busy = false;

  constructor(private readonly taskService: TaskService) {}

  async initialize(): Promise<void> {
    this.passwordForm.addEventListener("submit", event => { event.preventDefault(); void this.handlePassword(); });
    this.form.addEventListener("submit", event => { event.preventDefault(); void this.handleSubmit(); });
    this.filter.addEventListener("change", () => {
      void this.run("Cargando tareas…", "Filtro aplicado.", async () => {
        await this.taskService.filterTasks(this.filter.value ? parsePriority(this.filter.value) : undefined);
      });
    });
    this.complete.addEventListener("click", () => {
      void this.run("Completando prioridad…", "Prioridad completada.", async () => {
        await this.taskService.completePriority(parsePriority(this.filter.value));
      });
    });
    try {
      const hasPassword = await this.taskService.hasPassword();
      this.creatingPassword = !hasPassword;
      document.querySelector("#password-label")!.textContent = hasPassword
        ? "Ingresa tu contraseña para desbloquear las notas"
        : "Crea una contraseña de al menos 12 caracteres. Si la pierdes, no podrás recuperar las notas.";
      document.querySelector("#password-submit")!.textContent = hasPassword ? "Desbloquear" : "Crear contraseña";
      this.passwordInput.autocomplete = hasPassword ? "current-password" : "new-password";
      this.passwordInput.minLength = hasPassword ? 1 : 12;
      document.querySelector<HTMLElement>("#confirm-label")!.hidden = hasPassword;
      this.passwordConfirm.hidden = hasPassword;
      this.passwordConfirm.required = !hasPassword;
      this.passwordConfirm.minLength = 12;
      this.passwordForm.hidden = false;
      this.message.textContent = "";
    } catch (error) { this.showError(error); }
  }

  private setBusy(value: boolean): void {
    this.busy = value;
    this.taskSection.setAttribute("aria-busy", String(value));
    this.passwordForm.setAttribute("aria-busy", String(value));
    document.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>(
      '#task-section input, #task-section button, #task-section select, #task-section textarea, #password-form input, #password-form button',
    ).forEach(control => { control.disabled = value; });
    this.complete.disabled = value || !this.filter.value;
  }

  private async run(loading: string, success: string, operation: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.setBusy(true);
    this.message.dataset.state = "loading";
    this.message.textContent = loading;
    try {
      await operation();
      this.message.dataset.state = "success";
      this.message.textContent = success;
    } catch (error) { this.showError(error); }
    finally {
      this.renderTasks();
      this.setBusy(false);
    }
  }

  private async handlePassword(): Promise<void> {
    await this.run("Derivando clave y cargando tareas…", "Notas desbloqueadas.", async () => {
      if (this.creatingPassword && this.passwordInput.value !== this.passwordConfirm.value) throw new Error("Las contraseñas no coinciden");
      await this.taskService.unlock(this.passwordInput.value);
      this.passwordInput.value = "";
      this.passwordConfirm.value = "";
      this.passwordForm.hidden = true;
      this.taskSection.hidden = false;
    });
    if (!this.taskSection.hidden) this.titleInput.focus();
  }

  private async handleSubmit(): Promise<void> {
    const title = this.titleInput.value.trim();
    if (!title) { this.showError(new Error("Escribe un título.")); return; }
    await this.run("Cifrando y guardando tarea…", "Tarea guardada.", async () => {
      await this.taskService.createTask(title, parsePriority(this.prioritySelect.value), this.noteInput.value);
      this.form.reset();
    });
    this.titleInput.focus();
  }

  private renderTasks(): void {
    this.taskListView.render(this.taskService.getTasks(), {
      onToggle: id => this.run("Guardando estado…", "Estado guardado.", () => this.taskService.toggleTask(id)),
      onDelete: id => this.run("Eliminando tarea…", "Tarea eliminada.", () => this.taskService.deleteTask(id)),
      onReadNote: id => this.taskService.readNote(id),
    });
  }

  showError(error: unknown): void {
    this.message.dataset.state = "error";
    this.message.textContent = error instanceof Error ? error.message : "Ocurrió un error de almacenamiento";
  }
}
