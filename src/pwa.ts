import { Workbox } from "workbox-window";
import { monitorConnectivity } from "./connectivity";
import { initializeInstall } from "./install";

export function initializePwa(): void {
  monitorConnectivity(document.querySelector<HTMLElement>("#connectivity")!);
  initializeInstall();
  const status = document.querySelector<HTMLElement>("#pwa-status")!;
  const update = document.querySelector<HTMLButtonElement>("#update")!;

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
