interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSAL_KEY = "gestor-install-dismissed-until";
const DISMISSAL_MS = 7 * 24 * 60 * 60 * 1000;

export function initializeInstall(): void {
  const install = document.querySelector<HTMLButtonElement>("#install")!;
  const dismiss = document.querySelector<HTMLButtonElement>("#install-dismiss")!;
  const help = document.querySelector<HTMLElement>("#install-help")!;
  const status = document.querySelector<HTMLElement>("#install-status")!;
  const standalone = matchMedia("(display-mode: standalone)");
  const device = navigator as Navigator & { standalone?: boolean };
  const isIOS = /iPhone|iPad|iPod/.test(device.userAgent) ||
    (/Macintosh/.test(device.userAgent) && device.maxTouchPoints > 1);
  let prompt: InstallPrompt | undefined;
  let installationConfirmed = false;
  let prompting = false;
  let awaitingInstallation = false;
  let dismissedUntil = 0;
  let expiryTimer: number | undefined;
  try {
    dismissedUntil = Number(localStorage.getItem(DISMISSAL_KEY)) || 0;
  } catch { /* El aplazamiento funciona en memoria durante esta visita. */ }

  if (isIOS) {
    help.textContent = "En Safari: Compartir → Añadir a pantalla de inicio, si está disponible.";
  }

  const isInstalled = (): boolean => installationConfirmed || standalone.matches || device.standalone === true;
  const render = (): void => {
    window.clearTimeout(expiryTimer);
    const remaining = dismissedUntil - Date.now();
    if (remaining <= 0 && dismissedUntil !== 0) {
      dismissedUntil = 0;
      if (!isInstalled()) status.textContent = "";
    }
    const show = !isInstalled() && remaining <= 0 && !prompting && !awaitingInstallation;
    install.hidden = !show || !prompt;
    dismiss.hidden = !show;
    help.hidden = !show || Boolean(prompt);
    if (!isInstalled() && remaining > 0) {
      expiryTimer = window.setTimeout(render, Math.min(remaining, DISMISSAL_MS));
    }
  };

  const installed = (): void => {
    prompt = undefined;
    status.textContent = "Aplicación instalada.";
    render();
  };
  if (isInstalled()) installed();
  else render();
  standalone.addEventListener("change", () => { if (isInstalled()) installed(); else render(); });
  window.addEventListener("focus", render);
  window.addEventListener("appinstalled", () => {
    installationConfirmed = true;
    installed();
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    if (isInstalled()) return;
    prompt = event as InstallPrompt;
    awaitingInstallation = false;
    render();
  });

  dismiss.addEventListener("click", () => {
    dismissedUntil = Date.now() + DISMISSAL_MS;
    try {
      localStorage.setItem(DISMISSAL_KEY, String(dismissedUntil));
      status.textContent = "No volveremos a sugerir la instalación durante 7 días.";
    } catch {
      status.textContent = "Sugerencia ocultada durante esta visita.";
    }
    render();
    status.focus();
  });

  install.addEventListener("click", async () => {
    if (!prompt || install.hidden) return;
    const current = prompt;
    prompt = undefined;
    prompting = true;
    render();
    try {
      await current.prompt();
      const choice = await current.userChoice;
      if (!isInstalled()) {
        awaitingInstallation = choice.outcome === "accepted" && !prompt;
        status.textContent = choice.outcome === "accepted"
          ? "Instalación solicitada."
          : "Puedes instalar más tarde si el navegador ofrece la opción.";
      }
    } catch {
      if (!isInstalled()) status.textContent = "No se pudo abrir la instalación.";
    } finally {
      prompting = false;
      render();
    }
  });
}
