import { test, expect } from '@playwright/test';

test('precache completo permite primera recarga offline y dos rutas runtime reales', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    await fetch('/manifest.json');
  });
  await page.reload();
  await expect.poll(() => page.evaluate(async () => {
    const manifest = await caches.open('gestor-manifest');
    const pages = await caches.open('gestor-navigation');
    const navigation = await caches.keys();
    return (await manifest.keys()).length > 0 && (await pages.keys()).length > 0 && navigation.some(key => key.includes('precache'));
  })).toBe(true);
  // Fuerza la reserva precargada, sin depender del HTML cacheado en runtime.
  await page.evaluate(() => caches.delete('gestor-navigation'));
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#password-form')).toBeVisible();
  await page.locator('#password-input').fill('contraseña offline');
  await page.locator('#password-confirm').fill('contraseña offline');
  await page.locator('#password-submit').click();
  await page.locator('#title-input').fill('Tarea offline');
  await page.locator('#note-input').fill('Secreto offline');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.locator('#task-list')).toContainText('Tarea offline');
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('gestor-tareas-db');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result = await new Promise<any>((resolve, reject) => {
      const request = db.transaction('tareas').objectStore('tareas').getAll();
      request.onsuccess = () => resolve(request.result[0]);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return { keys: Object.keys(result), encrypted: result.noteCiphertext instanceof ArrayBuffer, ivLength: result.noteIv.length, title: result.title, priority: result.priority };
  });
  expect(stored.encrypted).toBe(true);
  expect(stored.ivLength).toBe(12);
  expect(stored.keys).not.toContain('privateNote');
  expect(stored.title).toBe('Tarea offline');
  expect(stored.priority).toBe('medium');
  await page.reload();
  await page.locator('#password-input').fill('contraseña equivocada');
  await page.locator('#password-submit').click();
  await expect(page.locator('#message')).toContainText('incorrecta');
  await page.locator('#password-input').fill('contraseña offline');
  await page.locator('#password-submit').click();
  await page.getByRole('button', { name: 'Ver nota', exact: true }).click();
  await expect(page.locator('.private-note')).toHaveText('Secreto offline');
  await page.getByRole('checkbox').check();
  await expect(page.locator('.task')).toHaveClass(/task--completed/);
  await page.getByRole('button', { name: 'Eliminar Tarea offline', exact: true }).click();
  await expect(page.locator('.task')).toHaveCount(0);
});
