import { TaskService } from "./services/TaskService";
import { TaskView } from "./views/TaskView";
import { LocalStorageTaskStorage } from "./storage/TaskStorage";

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

const taskService = new TaskService(new LocalStorageTaskStorage());
const taskView = new TaskView(taskService);

taskView.initialize();
