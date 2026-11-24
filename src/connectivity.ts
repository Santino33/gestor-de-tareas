const PROBE_TIMEOUT_MS = 3_000;
const SERVER_MARKER = "gestor-tareas-red-ok";

export function monitorConnectivity(status: HTMLElement): void {
  let active: AbortController | undefined;

  const check = async (): Promise<void> => {
    active?.abort();
    active = undefined;
    if (!navigator.onLine) {
      status.textContent = "Sin conexión: tus tareas se guardan en este dispositivo.";
      return;
    }

    const probe = new AbortController();
    active = probe;
    status.textContent = "Comprobando si responde el servidor…";
    const timeout = window.setTimeout(() => probe.abort(), PROBE_TIMEOUT_MS);
    let reachable = false;
    try {
      const response = await fetch("/red.txt", { cache: "no-store", redirect: "error", signal: probe.signal });
      reachable = response.ok && (await response.text()).trim() === SERVER_MARKER;
    } catch {
      // Sin respuesta válida dentro del plazo; las tareas siguen siendo locales.
    } finally {
      window.clearTimeout(timeout);
      if (active === probe) {
        active = undefined;
        status.textContent = reachable && !probe.signal.aborted
          ? "El servidor del gestor responde."
          : "El servidor no responde o no se pudo verificar. Puedes seguir trabajando en este dispositivo.";
      }
    }
  };

  window.addEventListener("online", check);
  window.addEventListener("offline", check);
  void check();
}
