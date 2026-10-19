import { TaskService } from "./services/TaskService";
import { TaskView } from "./views/TaskView";
import { TaskStorage } from "./storage/TaskStorage";
import { initializePwa } from "./pwa";

initializePwa();

TaskStorage.open(() => {
  document.querySelector("#message")!.textContent = "La base de datos cambió en otra pestaña. Recarga para continuar.";
  document.querySelectorAll<HTMLButtonElement>("#task-section button").forEach(button => { button.disabled = true; });
})
  .then((storage) => new TaskView(new TaskService(storage)).initialize())
  .catch((error: unknown) => {
    const message = document.querySelector("#message");
    if (message) message.textContent = error instanceof Error ? error.message : "No se pudo abrir IndexedDB";
  });
