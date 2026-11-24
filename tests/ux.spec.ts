import { test, expect, type Page } from '@playwright/test';

async function createPassword(page: Page): Promise<void> {
  await page.locator('#password-input').fill('contraseña segura');
  await page.locator('#password-confirm').fill('contraseña segura');
  await page.locator('#password-submit').click();
  await expect(page.locator('#task-form')).toBeVisible();
}

async function offerInstall(page: Page, outcome: 'accepted' | 'dismissed'): Promise<void> {
  // Simula el contrato del evento, no la instalación nativa.
  await page.evaluate(choice => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: choice }) });
    dispatchEvent(event);
  }, outcome);
}

test('el borrador sobrevive a cambios en la lista y solo se limpia al guardar con éxito', async ({ page }) => {
  await page.addInitScript(() => {
    // Hace fallar una escritura real sin afectar a la creación de la contraseña.
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (value, key) {
      const request = add.call(this, value, key);
      if (this.name === 'tareas' && value.title === 'Borrador' && !document.body.hasAttribute('data-allow-save')) {
        this.transaction.abort();
      }
      return request;
    };
  });
  await page.goto('/');
  await createPassword(page);
  const title = page.locator('#title-input');
  const note = page.locator('#note-input');
  const priority = page.locator('#priority-select');
  const add = page.getByRole('button', { name: 'Agregar', exact: true });
  await title.fill('Tarea existente');
  await add.click();
  await expect(page.locator('#message')).toHaveText('Tarea guardada.');

  await title.fill('Borrador');
  await note.fill('Nota aún sin guardar');
  await priority.selectOption('high');
  const expectDraft = async () => {
    await expect(title).toHaveValue('Borrador');
    await expect(note).toHaveValue('Nota aún sin guardar');
    await expect(priority).toHaveValue('high');
  };
  await page.locator('#priority-filter').selectOption('medium');
  await expect(page.locator('#message')).toHaveText('Filtro aplicado.');
  await expectDraft();
  await page.getByRole('checkbox').check();
  await expect(page.locator('#message')).toHaveText('Estado guardado.');
  await expectDraft();
  await page.locator('#priority-filter').selectOption('');
  await add.click();
  await expect(page.locator('#message')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('.task')).toHaveCount(1);
  await expectDraft();

  await page.evaluate(() => document.body.setAttribute('data-allow-save', ''));
  await add.click();
  await expect(page.locator('#message')).toHaveText('Tarea guardada.');
  await expect(page.locator('.task')).toHaveCount(2);
  await expect(title).toHaveValue('');
  await expect(note).toHaveValue('');
  await expect(priority).toHaveValue('medium');
});

test('conectividad real y filtro por prioridad', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('#connectivity')).toHaveText('El servidor del gestor responde.');
  await context.setOffline(true);
  await expect(page.locator('#connectivity')).toContainText('Sin conexión');
  await context.setOffline(false);
  await expect(page.locator('#connectivity')).toHaveText('El servidor del gestor responde.');
  await createPassword(page);
  for (const [title, priority] of [['Importante', 'high'], ['Otra', 'low']]) {
    await page.locator('#title-input').fill(title);
    await page.locator('#priority-select').selectOption(priority);
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(page.locator('#message')).toHaveText('Tarea guardada.');
  }
  await page.locator('#priority-filter').selectOption('high');
  await expect(page.locator('.task')).toHaveCount(1);
  await page.getByRole('button', { name: 'Completar esta prioridad' }).click();
  await expect(page.locator('.task')).toHaveClass(/task--completed/);
  await page.locator('#priority-filter').selectOption('low');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
});

test('la comprobación rechaza HTTP fallido, HTML de fallback y una respuesta lenta; no bloquea tareas', async ({ page }) => {
  const url = '**/red.txt';
  const status = page.locator('#connectivity');
  const failed = /El servidor no responde/;
  await page.route(url, route => route.fulfill({ status: 503, body: 'gestor-tareas-red-ok' }));
  await page.goto('/');
  await expect(status).toHaveText(failed);
  await createPassword(page);
  await page.locator('#title-input').fill('Tarea sin servidor');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await page.getByRole('checkbox').check();
  await expect(page.locator('.task')).toHaveClass(/task--completed/);

  await page.unroute(url);
  await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<html>Fallback</html>' }));
  await page.reload();
  await expect(status).toHaveText(failed);

  await page.unroute(url);
  await page.clock.install();
  // Mantener la petición pendiente hasta que el reloj dispare el AbortController.
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(url, async route => {
    await pending;
    await route.abort();
  });
  const request = page.waitForRequest(url);
  await page.reload();
  await request;
  await expect(status).toContainText('Comprobando');
  try {
    await page.clock.fastForward(3_000);
    await expect(status).toHaveText(failed);
  } finally {
    release();
  }
});

test('una comprobación anterior no puede sobrescribir el estado tras perder y recuperar la red', async ({ page }) => {
  await page.addInitScript(() => {
    let online = true;
    Object.defineProperty(navigator, 'onLine', { get: () => online });
    window.addEventListener('test-offline', () => { online = false; dispatchEvent(new Event('offline')); });
    window.addEventListener('test-online', () => { online = true; dispatchEvent(new Event('online')); });
    const nativeFetch = window.fetch;
    let first = true;
    window.fetch = (input, options) => {
      if (input !== '/red.txt' || !first) return nativeFetch(input, options);
      first = false;
      // Ignora el aborto a propósito para comprobar también la protección contra respuestas obsoletas.
      return new Promise(resolve => window.addEventListener('test-finish', () => {
        document.body.dataset.aborted = String(options?.signal?.aborted);
        resolve(new Response('contenido obsoleto'));
      }, { once: true }));
    };
  });
  await page.goto('/');
  const status = page.locator('#connectivity');
  await expect(status).toContainText('Comprobando');
  await page.evaluate(() => dispatchEvent(new Event('test-offline')));
  await expect(status).toContainText('Sin conexión');
  await page.evaluate(() => dispatchEvent(new Event('test-online')));
  await expect(status).toHaveText('El servidor del gestor responde.');
  await page.evaluate(async () => {
    dispatchEvent(new Event('test-finish'));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  await expect(page.locator('body')).toHaveAttribute('data-aborted', 'true');
  await expect(status).toHaveText('El servidor del gestor responde.');
});

test.describe('instalación con eventos controlados', () => {
  test.use({ serviceWorkers: 'block' });

  test('aplaza siete días, conserva el aplazamiento al recargar y distingue solicitud de instalación', async ({ page }) => {
    const start = new Date('2026-01-01T12:00:00Z');
    await page.clock.install({ time: start });
    await page.goto('/');
    const install = page.getByRole('button', { name: 'Instalar aplicación' });
    const later = page.getByRole('button', { name: 'Ahora no' });
    const status = page.locator('#install-status');
    await expect(install).toBeHidden();
    await offerInstall(page, 'dismissed');
    await install.click();
    await expect(status).toContainText('más tarde');
    await expect(install).toBeHidden();
    await offerInstall(page, 'accepted');
    await later.click();
    await expect(status).toContainText('7 días');
    await expect(status).toBeFocused();
    await page.reload();
    await offerInstall(page, 'accepted');
    await expect(install).toBeHidden();
    await expect(later).toBeHidden();
    await expect(page.locator('#install-help')).toBeHidden();
    await page.clock.fastForward(7 * 24 * 60 * 60 * 1000 - 60_000);
    await expect(install).toBeHidden();
    await page.clock.fastForward(61_000);
    await install.click();
    await expect(status).toHaveText('Instalación solicitada.');
    await page.evaluate(() => dispatchEvent(new Event('appinstalled')));
    await expect(status).toHaveText('Aplicación instalada.');
    await offerInstall(page, 'accepted');
    await expect(install).toBeHidden();
    await expect(later).toBeHidden();
  });

  test('ofrece instrucciones en iOS sin prompt y las oculta en modo instalado', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone) Safari' });
      Object.defineProperty(navigator, 'standalone', { value: location.hash === '#instalada' });
    });
    await page.goto('/');
    await expect(page.locator('#install-help')).toContainText('Compartir → Añadir a pantalla de inicio');
    await expect(page.locator('#install')).toBeHidden();
    await page.goto('/#instalada');
    await page.reload();
    await expect(page.locator('#install-status')).toHaveText('Aplicación instalada.');
    await expect(page.locator('#install-help')).toBeHidden();
    await expect(page.locator('#install-dismiss')).toBeHidden();
  });

  test('puede ocultar la sugerencia aunque no pueda guardar el aplazamiento', async ({ page }) => {
    await page.addInitScript(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'gestor-install-dismissed-until') throw new DOMException('Bloqueado', 'SecurityError');
        setItem.call(this, key, value);
      };
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Ahora no' }).click();
    await expect(page.locator('#install-status')).toHaveText('Sugerencia ocultada durante esta visita.');
    await offerInstall(page, 'accepted');
    await expect(page.locator('#install')).toBeHidden();
    await createPassword(page);
  });
});

test('importa una tarea legada al desbloquear y no la duplica al recargar', async ({ page }) => {
  await page.route('**/preparar-migracion', route => route.fulfill({ contentType: 'text/html', body: '<title>Preparar datos legados</title>' }));
  await page.goto('/preparar-migracion');
  await page.evaluate(() => localStorage.setItem('electiva-pwa-tareas', JSON.stringify([{
    id: 'tarea-legada',
    titulo: 'Tarea legada',
    prioridad: 'alta',
    completada: true,
    fechaCreacion: '2026-01-01T00:00:00.000Z',
  }])));
  await page.goto('/');
  await createPassword(page);
  const task = page.locator('.task');
  await expect(task).toHaveCount(1);
  await expect(task).toContainText('Tarea legada');
  await expect(task).toHaveClass(/task--high/);
  await expect(task.getByRole('checkbox')).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('electiva-pwa-tareas'))).toBeNull();
  await page.reload();
  await page.locator('#password-input').fill('contraseña segura');
  await page.locator('#password-submit').click();
  await expect(task).toHaveCount(1);
  await expect(task).toContainText('Tarea legada');
});
