import { Workbox } from "workbox-window";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function initializePwa(): void {
  const connectivity = document.querySelector<HTMLElement>("#connectivity")!;
  const install = document.querySelector<HTMLButtonElement>("#install")!;
  const help = document.querySelector<HTMLElement>("#install-help")!;
  const status = document.querySelector<HTMLElement>("#pwa-status")!;
  const update = document.querySelector<HTMLButtonElement>("#update")!;
  const connectionChanged = (): void => {
    connectivity.textContent = navigator.onLine
      ? "Red disponible según el dispositivo (no garantiza acceso a Internet)."
      : "Sin conexión: tus tareas se guardan en este dispositivo.";
  };
  connectionChanged();
  window.addEventListener("online", connectionChanged);
  window.addEventListener("offline", connectionChanged);
  let prompt: InstallPrompt | undefined;
  const standalone = matchMedia("(display-mode: standalone)");
  const installed = (): void => { prompt = undefined; install.hidden = true; help.hidden = true; };
  if (standalone.matches) installed();
  standalone.addEventListener("change", () => { if (standalone.matches) installed(); });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    prompt = event as InstallPrompt;
    install.hidden = false;
    help.hidden = true;
  });
  window.addEventListener("appinstalled", installed);
  install.addEventListener("click", async () => {
    if (!prompt) return;
    const current = prompt;
    prompt = undefined;
    install.disabled = true;
    try {
      await current.prompt();
      const choice = await current.userChoice;
      status.textContent = choice.outcome === "accepted" ? "Instalación solicitada." : "Puedes instalar más tarde desde el menú del navegador.";
    } catch { status.textContent = "No se pudo abrir la instalación. Usa el menú del navegador."; }
    finally { install.hidden = true; install.disabled = false; }
  });

  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  const wb = new Workbox("/sw.js");
  let reloadRequested = false;
  wb.addEventListener("waiting", () => {
    update.hidden = false;
    status.textContent = "Hay una actualización disponible. Guarda tus cambios antes de actualizar.";
  });
  wb.addEventListener("activated", (event) => {
    if (!event.isUpdate) status.textContent = "Recursos preparados para trabajar sin conexión.";
  });
  wb.addEventListener("controlling", () => { if (reloadRequested) location.reload(); });
  update.addEventListener("click", () => {
    if (document.querySelector('[aria-busy="true"]')) {
      status.textContent = "Espera a que termine la operación antes de actualizar.";
      return;
    }
    const dirty = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type="checkbox"]), textarea')).some(input => input.value);
    if (dirty && !confirm("Hay texto sin guardar. ¿Descartarlo y actualizar?")) return;
    reloadRequested = true;
    update.disabled = true;
    wb.messageSkipWaiting();
  });
  void wb.register().then(async () => {
    await navigator.serviceWorker.ready;
    // El manifiesto no pertenece al precache: calentar su ruta runtime tras el control.
    const warmManifest = (): void => { void fetch('/manifest.json').catch(() => undefined); };
    if (navigator.serviceWorker.controller) warmManifest();
    else navigator.serviceWorker.addEventListener('controllerchange', warmManifest, { once: true });
  }).catch(() => { status.textContent = "No se pudo preparar el modo sin conexión. Recarga con conexión para reintentar."; });
}
