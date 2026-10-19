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
  await page.reload();
  await page.locator('#password-input').fill('contraseña offline');
  await page.locator('#password-submit').click();
  await page.getByRole('button', { name: 'Ver nota', exact: true }).click();
  await expect(page.locator('.private-note')).toHaveText('Secreto offline');
  await page.getByRole('checkbox').check();
  await expect(page.locator('.task')).toHaveClass(/task--completed/);
  await page.getByRole('button', { name: 'Eliminar Tarea offline', exact: true }).click();
  await expect(page.locator('.task')).toHaveCount(0);
});
