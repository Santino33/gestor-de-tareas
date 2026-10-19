import { TaskService } from "./services/TaskService";
import { TaskView } from "./views/TaskView";
import { TaskStorage } from "./storage/TaskStorage";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service worker registrado:", registration.scope);
      })
      .catch((error) => {
        console.error("Error al registrar el service worker:", error);
      });
  });
}

TaskStorage.open()
  .then((storage) => new TaskView(new TaskService(storage)).initialize())
  .catch((error: unknown) => {
    const message = document.querySelector("#message");
    if (message) message.textContent = error instanceof Error ? error.message : "No se pudo abrir IndexedDB";
  });
