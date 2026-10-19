import { test, expect } from '@playwright/test';

test('conectividad, instalación simulada y filtro por prioridad', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('#connectivity')).toContainText('no garantiza');
  await context.setOffline(true);
  await expect(page.locator('#connectivity')).toContainText('Sin conexión');
  await context.setOffline(false);
  await expect(page.locator('#connectivity')).toContainText('Red disponible');
  // Simula exclusivamente el contrato del evento; no acredita instalación nativa.
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt');
    Object.assign(event, { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    dispatchEvent(event);
  });
  await page.getByRole('button', { name: 'Instalar aplicación' }).click();
  await expect(page.locator('#pwa-status')).toContainText('más tarde');
  await page.locator('#password-input').fill('contraseña segura');
  await page.locator('#password-confirm').fill('contraseña segura');
  await page.locator('#password-submit').click();
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
